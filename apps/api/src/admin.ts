import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { Db, AuthGuard, AuthedRequest, parse, equal, audit, redis } from './core';
@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private db: Db) {}
  private check(req: AuthedRequest) {
    if (!req.user.isSuperAdmin || !req.user.verifiedAt)
      throw new ForbiddenException('Platform admin access required');
  }
  private async privileged(req: AuthedRequest, password: string) {
    this.check(req);
    if (
      !process.env.ADMIN_ACTION_KEY ||
      !equal(req.get('x-admin-action-key') || '', process.env.ADMIN_ACTION_KEY)
    )
      throw new ForbiddenException('Privileged action key required');
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.user.id } });
    if (!(await argon2.verify(user.passwordHash, password)))
      throw new ForbiddenException('Reauthentication failed');
  }
  @Get('overview') async overview(@Req() req: AuthedRequest) {
    this.check(req);
    const [users, workspaces, subscriptions, executions, errors, audits] = await Promise.all([
      this.db.user.count(),
      this.db.workspace.count(),
      this.db.subscription.count({ where: { status: 'ACTIVE' } }),
      this.db.automationExecution.count(),
      this.db.automationExecution.count({ where: { status: { in: ['FAILED', 'UNKNOWN'] } } }),
      this.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return {
      users,
      workspaces,
      subscriptions,
      executions,
      errors,
      audits,
      workerHeartbeat: (await redis?.get('creatorflow:worker-heartbeat').catch(() => null)) || null,
    };
  }
  @Get('users') async users(@Req() req: AuthedRequest, @Query('search') search = '') {
    this.check(req);
    return this.db.user.findMany({
      where: { email: { contains: search.slice(0, 100), mode: 'insensitive' } },
      select: {
        id: true,
        name: true,
        email: true,
        verifiedAt: true,
        suspendedAt: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get('workspaces') async workspaces(@Req() req: AuthedRequest) {
    this.check(req);
    return this.db.workspace.findMany({
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { members: true, leads: true, automations: true } },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get('plans') plans(@Req() req: AuthedRequest) {
    this.check(req);
    return this.db.subscriptionPlan.findMany({ orderBy: { createdAt: 'asc' } });
  }
  @Get('monitoring') async monitoring(@Req() req: AuthedRequest) {
    this.check(req);
    return {
      events: await this.db.automationEvent.findMany({
        select: { id: true, status: true, createdAt: true, workspaceId: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
      executions: await this.db.automationExecution.findMany({
        select: {
          id: true,
          status: true,
          errorCode: true,
          attempts: true,
          workspaceId: true,
          createdAt: true,
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
      mail: await this.db.emailOutbox.groupBy({ by: ['status'], _count: true }),
      accounts: await this.db.connectedSocialAccount.findMany({
        select: {
          id: true,
          workspaceId: true,
          username: true,
          status: true,
          diagnostic: true,
          expiresAt: true,
        },
        take: 100,
      }),
      payments: await this.db.payment.findMany({ take: 50, orderBy: { createdAt: 'desc' } }),
    };
  }
  @Get('support') support(@Req() req: AuthedRequest) {
    this.check(req);
    return this.db.supportTicket.findMany({ take: 100, orderBy: { createdAt: 'desc' } });
  }
  @Patch('support/:id') async supportReply(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    this.check(req);
    const b = parse(
      z.object({
        response: z.string().min(2).max(5000),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
      }),
      input,
    );
    await audit(this.db, req.user.id, 'SUPPORT_RESPONSE', undefined, id);
    return this.db.supportTicket.update({ where: { id }, data: b });
  }
  @Post('plans') async plan(@Req() req: AuthedRequest, @Body() input: unknown) {
    const b = parse(
      z
        .object({
          password: z.string(),
          id: z.string().optional(),
          name: z.string().min(2).max(80),
          description: z.string().max(1000),
          priceMinor: z.number().int().min(0).nullable(),
          currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
          published: z.boolean(),
          stripePriceId: z.string().startsWith('price_').nullable(),
          limits: z.object({
            leads: z.number().int().min(0),
            accounts: z.number().int().min(0),
            automations: z.number().int().min(0),
            executions: z.number().int().min(0),
            team: z.number().int().min(1),
            workflows: z.number().int().min(0),
          }),
          features: z.array(z.string().max(100)).max(30),
        })
        .strict(),
      input,
    );
    await this.privileged(req, b.password);
    const { password, id, ...data } = b;
    return this.db.$transaction(async (tx) => {
      const plan = id
        ? await tx.subscriptionPlan.update({ where: { id }, data })
        : await tx.subscriptionPlan.create({ data });
      await audit(tx, req.user.id, 'PLAN_UPDATED', undefined, plan.id);
      return plan;
    });
  }
  @Patch('users/:id') async user(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    const b = parse(z.object({ password: z.string(), suspended: z.boolean() }).strict(), input);
    await this.privileged(req, b.password);
    if (req.user.id === id) throw new BadRequestException('Cannot suspend your own account');
    await this.db.$transaction([
      this.db.user.update({
        where: { id },
        data: { suspendedAt: b.suspended ? new Date() : null },
      }),
      this.db.session.deleteMany({ where: { userId: id } }),
      this.db.auditLog.create({
        data: {
          actorId: req.user.id,
          action: b.suspended ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
          targetId: id,
        },
      }),
    ]);
    return { ok: true };
  }
  @Patch('workspaces/:id') async workspace(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    const b = parse(z.object({ password: z.string(), suspended: z.boolean() }).strict(), input);
    await this.privileged(req, b.password);
    await this.db.workspace.update({
      where: { id },
      data: { suspendedAt: b.suspended ? new Date() : null },
    });
    await audit(this.db, req.user.id, 'WORKSPACE_STATUS_CHANGED', id);
    return { ok: true };
  }
  @Get('settings') async settings(@Req() req: AuthedRequest) {
    this.check(req);
    return this.db.systemSetting.findMany();
  }
  @Post('settings') async setting(@Req() req: AuthedRequest, @Body() input: unknown) {
    const b = parse(
      z
        .object({
          password: z.string(),
          key: z.enum(['maintenanceBanner', 'supportEmail', 'featureFlags']),
          value: z.union([z.string().max(1000), z.record(z.string(), z.boolean())]),
        })
        .strict(),
      input,
    );
    await this.privileged(req, b.password);
    await audit(this.db, req.user.id, 'SYSTEM_SETTING_CHANGED', undefined, b.key);
    return this.db.systemSetting.upsert({
      where: { key: b.key },
      create: { key: b.key, value: b.value },
      update: { value: b.value },
    });
  }
}
