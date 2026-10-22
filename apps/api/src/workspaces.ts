import {
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Delete,
  Req,
  Body,
  Param,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  Db,
  AuthGuard,
  TenantGuard,
  AuthedRequest,
  parse,
  requireRole,
  token,
  hash,
  config,
  quota,
  audit,
  workspaceLock,
} from './core';
import { queueMail } from './auth';
@ApiTags('Workspaces')
@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(private db: Db) {}
  @Post() async create(@Req() req: AuthedRequest, @Body() input: unknown) {
    if (!req.user.verifiedAt) throw new ForbiddenException('Verify your email first');
    const b = parse(
      z
        .object({
          name: z.string().trim().min(2).max(100),
          slug: z
            .string()
            .min(3)
            .max(60)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          category: z.string().max(60).default('Creator'),
          timezone: z
            .string()
            .refine((v) => {
              try {
                new Intl.DateTimeFormat('en', { timeZone: v });
                return true;
              } catch {
                return false;
              }
            })
            .default('Asia/Kolkata'),
        })
        .strict(),
      input,
    );
    if (
      (await this.db.workspaceMember.count({ where: { userId: req.user.id, role: 'OWNER' } })) >= 5
    )
      throw new BadRequestException('You can own at most five workspaces');
    return this.db.$transaction(async (tx) => {
      const trialSetting = await tx.systemSetting.findUnique({ where: { key: 'trialPlanId' } });
      const starter = await tx.subscriptionPlan.findUnique({ where: { name: 'Starter' } });
      const plan =
        starter?.published && starter.priceMinor === 0
          ? starter
          : await tx.subscriptionPlan.findUnique({
              where:
                typeof trialSetting?.value === 'string'
                  ? { id: trialSetting.value }
                  : { name: 'Free Trial' },
            });
      if (!plan) throw new BadRequestException('Run the plan seed before onboarding');
      const ws = await tx.workspace.create({
        data: {
          ...b,
          onboardingStep: 2,
          members: { create: { userId: req.user.id, role: 'OWNER' } },
          subscription: {
            create: {
              planId: plan.id,
              status: plan.priceMinor === 0 ? 'ACTIVE' : 'TRIALING',
              trialEndsAt: plan.priceMinor === 0 ? null : new Date(Date.now() + 14 * 86400000),
            },
          },
          store: { create: { name: b.name, slug: b.slug } },
        },
      });
      await audit(tx, req.user.id, 'WORKSPACE_CREATED', ws.id, ws.id);
      await queueMail(tx, req.user.email, 'Your CreatorFlow workspace is ready',
        `Hi ${req.user.name},\n\nYour workspace "${ws.name}" has been created.\n\nPlan: ${plan.name}${plan.priceMinor === 0 ? ' — free, with no expiry' : ''}.\n\n${config.appUrl}/onboarding\n\nFinish your setup, then start with a product, a lead form or an automation. Instagram connection is optional during setup. You can manage your plan from Billing.`);
      return ws;
    });
  }
  @Post('accept-invitation') async accept(@Req() req: AuthedRequest, @Body() input: unknown) {
    if (!req.user.verifiedAt) throw new ForbiddenException('Verify your email first');
    const b = parse(z.object({ token: z.string().length(64) }), input);
    return this.db.$transaction(async (tx) => {
      const invite = await tx.invitation.findUnique({ where: { tokenHash: hash(b.token) } });
      if (!invite || invite.expiresAt < new Date() || invite.email !== req.user.email)
        throw new BadRequestException('Invitation is invalid or expired');
      await workspaceLock(tx, invite.workspaceId);
      await quota(
        tx,
        invite.workspaceId,
        'team',
        await tx.workspaceMember.count({ where: { workspaceId: invite.workspaceId } }),
      );
      const claimed = await tx.invitation.deleteMany({ where: { id: invite.id } });
      if (!claimed.count) throw new BadRequestException('Invitation already accepted');
      return tx.workspaceMember.create({
        data: { workspaceId: invite.workspaceId, userId: req.user.id, role: invite.role },
      });
    });
  }
}
@ApiTags('Workspace settings')
@Controller('workspaces/:workspaceId')
@UseGuards(AuthGuard, TenantGuard)
export class WorkspaceSettingsController {
  constructor(private db: Db) {}
  @Get('settings') settings(@Req() req: AuthedRequest) {
    return this.db.workspace.findUnique({
      where: { id: req.workspaceId },
      include: { store: true },
    });
  }
  @Patch('settings') async update(@Req() req: AuthedRequest, @Body() input: unknown) {
    requireRole(req, ['OWNER', 'ADMIN']);
    const b = parse(
      z
        .object({
          name: z.string().trim().min(2).max(100).optional(),
          category: z.string().max(60).optional(),
          timezone: z
            .string()
            .refine((v) => {
              try {
                new Intl.DateTimeFormat('en', { timeZone: v });
                return true;
              } catch {
                return false;
              }
            })
            .optional(),
          onboardingStep: z.number().int().min(1).max(8).optional(),
        })
        .strict(),
      input,
    );
    return this.db.workspace.update({ where: { id: req.workspaceId }, data: b });
  }
  @Get('team') team(@Req() req: AuthedRequest) {
    return this.db.workspaceMember.findMany({
      where: { workspaceId: req.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }
  @Post('team/invite') async invite(@Req() req: AuthedRequest, @Body() input: unknown) {
    requireRole(req, ['OWNER', 'ADMIN']);
    const b = parse(
      z
        .object({
          email: z.string().trim().toLowerCase().email(),
          role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
        })
        .strict(),
      input,
    );
    if (req.role === 'ADMIN' && b.role === 'ADMIN')
      throw new ForbiddenException('Only owners can invite admins');
    const t = token();
    await this.db.$transaction(async (tx) => {
      await workspaceLock(tx, req.workspaceId);
      await quota(
        tx,
        req.workspaceId,
        'team',
        await tx.workspaceMember.count({ where: { workspaceId: req.workspaceId } }),
      );
      await tx.invitation.create({
        data: {
          workspaceId: req.workspaceId,
          ...b,
          tokenHash: hash(t),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      await queueMail(
        tx,
        b.email,
        'You are invited to CreatorFlow',
        `Join the workspace: ${config.appUrl}/invite?token=${t}`,
      );
      await audit(tx, req.user.id, 'TEAM_INVITED', req.workspaceId);
    });
    return { message: 'Invitation queued for delivery' };
  }
  @Patch('team/:id') async role(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    requireRole(req, ['OWNER']);
    const b = parse(z.object({ role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']) }).strict(), input);
    const member = await this.db.workspaceMember.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!member || member.role === 'OWNER')
      throw new BadRequestException('Owner role cannot be changed here');
    await this.db.$transaction([
      this.db.workspaceMember.update({ where: { id, workspaceId: req.workspaceId }, data: b }),
      this.db.auditLog.create({
        data: {
          actorId: req.user.id,
          action: 'ROLE_CHANGED',
          workspaceId: req.workspaceId,
          targetId: id,
        },
      }),
    ]);
    return { ok: true };
  }
  @Delete('team/:id') async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    requireRole(req, ['OWNER']);
    const member = await this.db.workspaceMember.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!member || member.role === 'OWNER')
      throw new BadRequestException('Cannot remove this member');
    await this.db.workspaceMember.delete({ where: { id, workspaceId: req.workspaceId } });
    await audit(this.db, req.user.id, 'MEMBER_REMOVED', req.workspaceId, id);
    return { ok: true };
  }
  @Get('notifications') notifications(@Req() req: AuthedRequest) {
    return this.db.notification.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
  @Post('notifications/read') async read(@Req() req: AuthedRequest) {
    await this.db.notification.updateMany({
      where: { workspaceId: req.workspaceId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
  @Get('billing') async billing(@Req() req: AuthedRequest) {
    requireRole(req, ['OWNER', 'ADMIN']);
    return {
      subscription: await this.db.subscription.findUnique({
        where: { workspaceId: req.workspaceId },
        include: { plan: true },
      }),
      usage: [
        ...(await this.db.usageRecord.findMany({
          where: {
            workspaceId: req.workspaceId,
            period: new Date().toISOString().slice(0, 7),
            metric: 'executions',
          },
        })),
        ...(await Promise.all(
          [
            ['leads', 'lead'],
            ['accounts', 'connectedSocialAccount'],
            ['team', 'workspaceMember'],
            ['automations', 'automation'],
            ['workflows', 'workflow'],
          ].map(async ([metric, model]) => ({
            metric,
            count: await (this.db as any)[model].count({
              where: {
                workspaceId: req.workspaceId,
                ...(['automations', 'workflows'].includes(metric) ? { status: 'ACTIVE' } : {}),
              },
            }),
          })),
        )),
      ],
      plans: await this.db.subscriptionPlan.findMany({ where: { published: true } }),
      configured: process.env.BILLING_ENABLED === 'true' && !!process.env.STRIPE_SECRET_KEY,
    };
  }
  @Get('export') async export(@Req() req: AuthedRequest) {
    requireRole(req, ['OWNER']);
    return {
      workspace: await this.db.workspace.findUnique({ where: { id: req.workspaceId } }),
      leads: await this.db.lead.findMany({
        where: { workspaceId: req.workspaceId },
        include: { notes: true, consents: true },
      }),
      forms: await this.db.leadForm.findMany({ where: { workspaceId: req.workspaceId } }),
      products: await this.db.product.findMany({ where: { workspaceId: req.workspaceId } }),
      orders: await this.db.order.findMany({
        where: { workspaceId: req.workspaceId },
        include: { items: true },
      }),
    };
  }
  @Delete() async delete(@Req() req: AuthedRequest, @Body() input: unknown) {
    requireRole(req, ['OWNER']);
    parse(z.object({ confirmation: z.literal('DELETE WORKSPACE') }), input);
    const sub = await this.db.subscription.findUnique({ where: { workspaceId: req.workspaceId } });
    if (sub?.providerSubscriptionId && sub.status !== 'CANCELED')
      throw new BadRequestException('Cancel billing before deleting the workspace');
    if (await this.db.fileAsset.count({ where: { workspaceId: req.workspaceId } }))
      throw new BadRequestException('Remove stored assets before deleting this workspace');
    await audit(this.db, req.user.id, 'WORKSPACE_DELETED', undefined, req.workspaceId);
    await this.db.workspace.delete({ where: { id: req.workspaceId } });
    return { ok: true };
  }
}
