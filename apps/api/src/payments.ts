import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Req,
  Body,
  UseGuards,
  ServiceUnavailableException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import Stripe from 'stripe';
import type { Request } from 'express';
import { z } from 'zod';
import {
  Db,
  AuthGuard,
  TenantGuard,
  AuthedRequest,
  config,
  parse,
  owned,
  requireRole,
  rateLimit,
  notify,
} from './core';
import { queueMail } from './auth';
@Injectable()
export class Payments {
  constructor(private db: Db) {}
  client() {
    if (!process.env.STRIPE_SECRET_KEY)
      throw new ServiceUnavailableException('Stripe is not configured');
    return new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  async paid(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (
      !['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(
        event.type,
      ) ||
      session.mode !== 'payment' ||
      session.payment_status !== 'paid'
    )
      return;
    const order = await this.db.order.findUnique({
      where: { checkoutId: session.id },
      include: { items: true, workspace: { include: { store: true } } },
    });
    if (!order) throw new BadRequestException('Unknown checkout');
    if (!event.account || order.workspace.store?.stripeAccountId !== event.account)
      throw new ForbiddenException('Payment merchant does not match this storefront');
    if (
      session.amount_total !== order.amountMinor ||
      session.currency?.toUpperCase() !== order.currency ||
      !session.payment_intent
    )
      throw new BadRequestException('Payment amount or currency mismatch');
    await this.db.$transaction(async (tx) => {
      if (await tx.paymentEvent.findUnique({ where: { id: event.id } })) return;
      await tx.paymentEvent.create({
        data: { id: event.id, provider: 'stripe', kind: event.type },
      });
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { status: 'PAID' },
      });
      if (!claimed.count) return;
      await tx.payment.create({
        data: {
          orderId: order.id,
          providerPaymentId: String(session.payment_intent),
          amountMinor: order.amountMinor,
          currency: order.currency,
          status: 'PAID',
        },
      });
      for (const item of order.items)
        await tx.digitalEntitlement.upsert({
          where: { orderId_productId: { orderId: order.id, productId: item.productId } },
          create: {
            workspaceId: order.workspaceId,
            orderId: order.id,
            productId: item.productId,
            email: order.email,
          },
          update: {},
        });
      await notify(tx, order.workspaceId, 'Payment completed', `Order ${order.id} was paid.`);
      await queueMail(
        tx,
        order.email,
        'Your CreatorFlow purchase',
        `Your payment has been verified. Sign in using this email to access your purchase: ${config.appUrl}/learn`,
      );
    });
  }
  async refund(event: Stripe.Event) {
    const charge = event.data.object as Stripe.Charge;
    const payment = await this.db.payment.findUnique({
      where: { providerPaymentId: String(charge.payment_intent) },
      include: { order: { include: { workspace: { include: { store: true } } } } },
    });
    if (!payment) return;
    if (event.account !== payment.order.workspace.store?.stripeAccountId)
      throw new ForbiddenException();
    await this.db.$transaction(async (tx) => {
      if (await tx.paymentEvent.findUnique({ where: { id: event.id } })) return;
      await tx.paymentEvent.create({
        data: { id: event.id, provider: 'stripe', kind: event.type },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: charge.refunded ? 'REFUNDED' : 'PARTIAL_REFUND' },
      });
      if (charge.refunded) {
        await tx.order.update({ where: { id: payment.orderId }, data: { status: 'REFUNDED' } });
        await tx.digitalEntitlement.updateMany({
          where: { orderId: payment.orderId },
          data: { revokedAt: new Date() },
        });
      }
    });
  }
  async subscription(event: Stripe.Event) {
    if (event.account) return;
    const remote = event.data.object as Stripe.Subscription;
    const sub =
      (await this.db.subscription.findUnique({ where: { providerSubscriptionId: remote.id } })) ||
      (remote.metadata.workspaceId
        ? await this.db.subscription.findUnique({
            where: { workspaceId: remote.metadata.workspaceId },
          })
        : null);
    if (!sub || String(remote.customer) !== sub.providerCustomerId) return;
    const priceId = remote.items.data[0]?.price.id;
    const plan = await this.db.subscriptionPlan.findFirst({ where: { stripePriceId: priceId } });
    if (!plan) return;
    await this.db.$transaction(async (tx) => {
      if (await tx.paymentEvent.findUnique({ where: { id: event.id } })) return;
      await tx.paymentEvent.create({
        data: { id: event.id, provider: 'stripe', kind: event.type },
      });
      const statuses: Record<string, string> = {
        active: 'ACTIVE',
        trialing: 'TRIALING',
        canceled: 'CANCELED',
        past_due: 'PAST_DUE',
        unpaid: 'UNPAID',
        incomplete: 'INCOMPLETE',
        incomplete_expired: 'EXPIRED',
        paused: 'PAUSED',
      };
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          providerSubscriptionId: remote.id,
          planId: plan.id,
          status: statuses[remote.status] || 'INCOMPLETE',
          cancelAtPeriodEnd: remote.cancel_at_period_end,
          currentPeriodEnd: new Date(
            ((remote.items.data[0] as any)?.current_period_end || 0) * 1000,
          ),
        },
      });
    });
  }
}
@Controller('checkout')
export class CheckoutController {
  constructor(
    private db: Db,
    private payments: Payments,
  ) {}
  @Post('products/:id') @UseGuards(AuthGuard) async checkout(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    if (!req.user.verifiedAt) throw new ForbiddenException('Verify your email first');
    await rateLimit(`checkout:${req.user.id}`, 10, 60);
    if (process.env.PAYMENTS_ENABLED !== 'true' || !process.env.MERCHANT_COUNTRY)
      throw new ServiceUnavailableException('Payments are not enabled for this deployment');
    const product = await this.db.product.findFirst({
      where: { id, published: true, workspace: { suspendedAt: null, store: { published: true } } },
      include: { workspace: { include: { store: true } } },
    });
    if (!product) throw new BadRequestException('Product is unavailable');
    const account = product.workspace.store?.stripeAccountId;
    if (!account)
      throw new ServiceUnavailableException(
        'The creator has not connected an approved payment account',
      );
    const client = this.payments.client();
    const merchant = await client.accounts.retrieve(account);
    if (!merchant.charges_enabled || !merchant.payouts_enabled)
      throw new ServiceUnavailableException('The merchant is not ready to accept payments');
    const order = await this.db.order.create({
      data: {
        workspaceId: product.workspaceId,
        email: req.user.email,
        amountMinor: product.priceMinor,
        currency: product.currency,
        items: {
          create: { productId: product.id, name: product.name, priceMinor: product.priceMinor },
        },
      },
    });
    const session = await client.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: req.user.email,
        line_items: [
          {
            price_data: {
              currency: product.currency.toLowerCase(),
              unit_amount: product.priceMinor,
              product_data: { name: product.name },
            },
            quantity: 1,
          },
        ],
        success_url: `${config.appUrl}/learn?payment=pending`,
        cancel_url: `${config.appUrl}/store/${product.workspace.store!.slug}`,
        metadata: { orderId: order.id },
      },
      { stripeAccount: account, idempotencyKey: `order-${order.id}` },
    );
    await this.db.order.update({ where: { id: order.id }, data: { checkoutId: session.id } });
    return { url: session.url };
  }
}
@Controller('workspaces/:workspaceId')
@UseGuards(AuthGuard, TenantGuard)
export class CommerceController {
  constructor(
    private db: Db,
    private payments: Payments,
  ) {}
  @Get('store') store(@Req() req: AuthedRequest) {
    return this.db.store.findUnique({
      where: { workspaceId: req.workspaceId },
      select: { name: true, slug: true, description: true, accent: true, published: true },
    });
  }
  @Get('store/payment-status') async paymentStatus(@Req() req: AuthedRequest) {
    requireRole(req, ['OWNER', 'ADMIN']);
    const store = await this.db.store.findUniqueOrThrow({
      where: { workspaceId: req.workspaceId },
    });
    if (!store.stripeAccountId) return { connected: false, ready: false };
    const account = await this.payments.client().accounts.retrieve(store.stripeAccountId);
    return {
      connected: true,
      ready: account.charges_enabled && account.payouts_enabled,
      requirements: account.requirements?.currently_due || [],
    };
  }
  @Post('store/connect-payments') async connectPayments(
    @Req() req: AuthedRequest,
    @Body() input: unknown,
  ) {
    requireRole(req, ['OWNER']);
    if (process.env.PAYMENTS_ENABLED !== 'true')
      throw new ServiceUnavailableException('Payments are not enabled for this deployment');
    const b = parse(z.object({ country: z.string().regex(/^[A-Z]{2}$/) }).strict(), input);
    const allowed = (process.env.STRIPE_CONNECT_COUNTRIES || '').split(',').filter(Boolean);
    if (!allowed.includes(b.country))
      throw new BadRequestException(
        'This merchant country has not been approved by the platform operator',
      );
    const client = this.payments.client();
    let store = await this.db.store.findUniqueOrThrow({ where: { workspaceId: req.workspaceId } });
    if (!store.stripeAccountId) {
      const account = await client.accounts.create(
        {
          type: 'express',
          country: b.country,
          email: req.user.email,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { workspaceId: req.workspaceId },
        },
        { idempotencyKey: `store-account-${req.workspaceId}` },
      );
      store = await this.db.store.update({
        where: { workspaceId: req.workspaceId },
        data: { stripeAccountId: account.id },
      });
    }
    const link = await client.accountLinks.create({
      account: store.stripeAccountId!,
      type: 'account_onboarding',
      refresh_url: `${config.appUrl}/app/store`,
      return_url: `${config.appUrl}/app/store`,
    });
    return { url: link.url };
  }
  @Patch('store') async update(@Req() req: AuthedRequest, @Body() input: unknown) {
    requireRole(req, ['OWNER', 'ADMIN']);
    const b = parse(
      z
        .object({
          name: z.string().min(2).max(100),
          description: z.string().max(3000),
          accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          published: z.boolean(),
        })
        .strict(),
      input,
    );
    return this.db.store.update({
      where: { workspaceId: req.workspaceId },
      data: b,
      select: { name: true, slug: true, description: true, accent: true, published: true },
    });
  }
  @Get('orders') orders(@Req() req: AuthedRequest) {
    return this.db.order.findMany({
      where: { workspaceId: req.workspaceId },
      include: { items: true, payment: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  @Post('billing/checkout') async billing(@Req() req: AuthedRequest, @Body() input: unknown) {
    requireRole(req, ['OWNER']);
    if (process.env.BILLING_ENABLED !== 'true' || !process.env.MERCHANT_COUNTRY)
      throw new ServiceUnavailableException('Subscription billing is not enabled');
    const b = parse(z.object({ planId: z.string() }), input);
    const plan = await this.db.subscriptionPlan.findFirst({
      where: { id: b.planId, published: true },
    });
    if (!plan?.stripePriceId)
      throw new BadRequestException('This plan is not configured for checkout');
    const client = this.payments.client();
    let sub = await this.db.subscription.findUniqueOrThrow({
      where: { workspaceId: req.workspaceId },
    });
    if (sub.providerSubscriptionId && !['CANCELED', 'EXPIRED'].includes(sub.status))
      throw new BadRequestException('Manage your existing subscription in the billing portal');
    if (!sub.providerCustomerId) {
      const customer = await client.customers.create(
        { email: req.user.email, metadata: { workspaceId: req.workspaceId } },
        { idempotencyKey: `workspace-${req.workspaceId}` },
      );
      sub = await this.db.subscription.update({
        where: { id: sub.id },
        data: { providerCustomerId: customer.id },
      });
    }
    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      customer: sub.providerCustomerId!,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      subscription_data: { metadata: { workspaceId: req.workspaceId } },
      success_url: `${config.appUrl}/app/billing?payment=pending`,
      cancel_url: `${config.appUrl}/app/billing`,
    });
    return { url: session.url };
  }
  @Post('billing/portal') async portal(@Req() req: AuthedRequest) {
    requireRole(req, ['OWNER']);
    if (process.env.BILLING_ENABLED !== 'true')
      throw new ServiceUnavailableException('Billing is not enabled');
    const sub = await this.db.subscription.findUnique({ where: { workspaceId: req.workspaceId } });
    if (!sub?.providerCustomerId) throw new BadRequestException('No billing customer exists yet');
    return this.payments.client().billingPortal.sessions.create({
      customer: sub.providerCustomerId,
      return_url: `${config.appUrl}/app/billing`,
    });
  }
}
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private payments: Payments) {}
  @Post(['', 'connect']) async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const isConnect = req.path.endsWith('/connect');
    const secret = isConnect
      ? process.env.STRIPE_CONNECT_WEBHOOK_SECRET
      : process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !req.rawBody)
      throw new ServiceUnavailableException('Stripe webhook is not configured');
    let event: Stripe.Event;
    try {
      event = this.payments
        .client()
        .webhooks.constructEvent(req.rawBody, req.get('stripe-signature') || '', secret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }
    if (isConnect !== !!event.account)
      throw new ForbiddenException('Stripe event destination does not match account scope');
    if (event.livemode !== (process.env.STRIPE_LIVE_MODE === 'true'))
      throw new ForbiddenException('Stripe event mode does not match this deployment');
    if (event.type.startsWith('checkout.session.')) await this.payments.paid(event);
    if (event.type === 'charge.refunded') await this.payments.refund(event);
    if (
      [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      ].includes(event.type)
    ) {
      const remote = event.data.object as Stripe.Subscription;
      if (event.type !== 'customer.subscription.deleted')
        (event.data as { object: unknown }).object = await this.payments
          .client()
          .subscriptions.retrieve(remote.id);
      await this.payments.subscription(event);
    }
    return { received: true };
  }
}
