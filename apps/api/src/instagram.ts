import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  Res,
  Param,
  Query,
  Body,
  ServiceUnavailableException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  Db,
  AuthGuard,
  TenantGuard,
  AuthedRequest,
  parse,
  token,
  hash,
  config,
  owned,
  encrypt,
  decrypt,
  signed,
  quota,
  workspaceLock,
  requireRole,
  audit,
} from './core';
export class MetaError extends Error {
  constructor(
    public code: number,
    public status: number,
    public ambiguous = false,
  ) {
    super(`Meta request failed (${code})`);
  }
}
@Injectable()
export class Instagram {
  configured() {
    return !!(
      process.env.META_APP_ID &&
      process.env.META_APP_SECRET &&
      process.env.META_GRAPH_VERSION &&
      process.env.TOKEN_ENCRYPTION_KEY
    );
  }
  async call(path: string, accessToken: string, body?: unknown) {
    const version = process.env.META_GRAPH_VERSION;
    if (!version || !/^v\d+\.\d+$/.test(version))
      throw new ServiceUnavailableException('Set a supported META_GRAPH_VERSION');
    let response: globalThis.Response;
    try {
      response = await fetch(`https://graph.instagram.com/${version}/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new MetaError(0, 0, !!body);
    }
    const data = (await response.json()) as any;
    if (!response.ok)
      throw new MetaError(
        data.error?.code || response.status,
        response.status,
        response.status >= 500 && !!body,
      );
    return data;
  }
  async privateReply(account: any, commentId: string, message: string) {
    return this.call(`${account.externalId}/messages`, decrypt(account.tokenCiphertext), {
      recipient: { comment_id: commentId },
      message: { text: message },
    });
  }
}
@Controller('workspaces/:workspaceId/integrations')
@UseGuards(AuthGuard, TenantGuard)
export class IntegrationsController {
  constructor(
    private db: Db,
    private instagram: Instagram,
  ) {}
  @Get() async list(@Req() req: AuthedRequest) {
    return {
      accounts: await this.db.connectedSocialAccount.findMany({
        where: { workspaceId: req.workspaceId },
        select: {
          id: true,
          username: true,
          externalId: true,
          status: true,
          permissions: true,
          expiresAt: true,
          diagnostic: true,
          webhookSubscribed: true,
        },
      }),
      instagram: {
        configured: this.instagram.configured(),
        approved: process.env.META_APPROVED === 'true',
      },
      storage: { configured: !!process.env.S3_BUCKET },
      stripe: {
        configured: !!process.env.STRIPE_SECRET_KEY,
        enabled: process.env.PAYMENTS_ENABLED === 'true',
      },
      email: {
        provider: process.env.EMAIL_PROVIDER || 'local',
        live: process.env.EMAIL_PROVIDER !== 'local',
      },
    };
  }
  @Post('instagram/connect') async connect(@Req() req: AuthedRequest) {
    requireRole(req, ['OWNER', 'ADMIN']);
    if (!this.instagram.configured())
      throw new ServiceUnavailableException(
        'Configure your Meta app ID, secret, graph version and encryption key first',
      );
    await quota(
      this.db,
      req.workspaceId,
      'accounts',
      await this.db.connectedSocialAccount.count({ where: { workspaceId: req.workspaceId } }),
    );
    const state = token();
    await this.db.oAuthState.create({
      data: {
        tokenHash: hash(state),
        workspaceId: req.workspaceId,
        userId: req.user.id,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      redirect_uri:
        process.env.META_REDIRECT_URI || `${config.appUrl}/api/integrations/instagram/callback`,
      response_type: 'code',
      scope:
        'instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages',
      state,
    }).toString();
    return { url: url.toString() };
  }
  @Delete('instagram/:id') async disconnect(@Req() req: AuthedRequest, @Param('id') id: string) {
    requireRole(req, ['OWNER', 'ADMIN']);
    await owned(this.db, 'connectedSocialAccount', req.workspaceId, id);
    await this.db.$transaction([
      this.db.automation.updateMany({
        where: { workspaceId: req.workspaceId, accountId: id },
        data: { status: 'PAUSED', accountId: null },
      }),
      this.db.connectedSocialAccount.delete({ where: { id, workspaceId: req.workspaceId } }),
    ]);
    await audit(this.db, req.user.id, 'INSTAGRAM_DISCONNECTED', req.workspaceId, id);
    return {
      message: 'Disconnected from CreatorFlow. You may also revoke the app in Instagram settings.',
    };
  }
  @Get('instagram/:id/media') async media(@Req() req: AuthedRequest, @Param('id') id: string) {
    const account = await owned<any>(this.db, 'connectedSocialAccount', req.workspaceId, id);
    return this.instagram.call(
      `${account.externalId}/media?fields=id,caption,media_type,permalink&limit=25`,
      decrypt(account.tokenCiphertext),
    );
  }
}
@Controller('integrations/instagram')
@UseGuards(AuthGuard)
export class InstagramCallbackController {
  constructor(
    private db: Db,
    private instagram: Instagram,
  ) {}
  @Get('callback') async callback(
    @Req() req: AuthedRequest,
    @Query() input: unknown,
    @Res() res: Response,
  ) {
    const b = parse(
      z.object({ code: z.string().min(1).max(4096), state: z.string().length(64) }),
      input,
    );
    const state = await this.db.oAuthState.findUnique({ where: { tokenHash: hash(b.state) } });
    if (!state || state.userId !== req.user.id || state.expiresAt < new Date())
      throw new ForbiddenException('Invalid OAuth state');
    const member = await this.db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: state.workspaceId, userId: req.user.id } },
    });
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) throw new ForbiddenException();
    const claimed = await this.db.oAuthState.deleteMany({ where: { id: state.id } });
    if (!claimed.count) throw new BadRequestException('OAuth state already used');
    const response = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri:
          process.env.META_REDIRECT_URI || `${config.appUrl}/api/integrations/instagram/callback`,
        code: b.code,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const short = (await response.json()) as any;
    if (!response.ok || !short.access_token)
      throw new BadRequestException('Instagram authorization failed. Please reconnect.');
    const exchange = new URL('https://graph.instagram.com/access_token');
    exchange.search = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: process.env.META_APP_SECRET!,
      access_token: short.access_token,
    }).toString();
    const longResponse = await fetch(exchange, { signal: AbortSignal.timeout(15000) });
    const long = (await longResponse.json()) as any;
    if (!longResponse.ok || !long.access_token)
      throw new BadRequestException('Could not exchange the Instagram token');
    const profile = await this.instagram.call('me?fields=user_id,username', long.access_token);
    const externalId = String(profile.user_id);
    if (!/^\d+$/.test(externalId) || !profile.username)
      throw new BadRequestException('Instagram did not return a professional account');
    let subscribed = false;
    try {
      const reply = await this.instagram.call(`${externalId}/subscribed_apps`, long.access_token, {
        subscribed_fields: 'comments',
      });
      subscribed = reply.success === true;
    } catch {}
    await this.db.$transaction(async (tx) => {
      await workspaceLock(tx, state.workspaceId);
      const existing = await tx.connectedSocialAccount.findUnique({ where: { externalId } });
      if (existing && existing.workspaceId !== state.workspaceId)
        throw new ForbiddenException('This account is already connected to another workspace');
      if (!existing)
        await quota(
          tx,
          state.workspaceId,
          'accounts',
          await tx.connectedSocialAccount.count({ where: { workspaceId: state.workspaceId } }),
        );
      const data = {
        username: String(profile.username),
        tokenCiphertext: encrypt(long.access_token),
        expiresAt: new Date(Date.now() + Number(long.expires_in || 5184000) * 1000),
        permissions: Array.isArray(short.permissions) ? short.permissions : [],
        status: 'CONNECTED',
        webhookSubscribed: subscribed,
        diagnostic: subscribed
          ? null
          : 'Webhook subscription failed. Check permissions and reconnect.',
      };
      await tx.connectedSocialAccount.upsert({
        where: { externalId },
        create: { workspaceId: state.workspaceId, externalId, ...data },
        update: data,
      });
      await audit(tx, req.user.id, 'INSTAGRAM_CONNECTED', state.workspaceId);
    });
    res.redirect(`${config.appUrl}/app/social-accounts`);
  }
}
@Controller('webhooks/meta')
export class MetaWebhookController {
  constructor(private db: Db) {}
  @Get() verify(@Query() query: Record<string, string>, @Res() res: Response) {
    if (
      query['hub.mode'] !== 'subscribe' ||
      !process.env.META_WEBHOOK_VERIFY_TOKEN ||
      query['hub.verify_token'] !== process.env.META_WEBHOOK_VERIFY_TOKEN
    )
      throw new ForbiddenException('Invalid verification token');
    return res.status(200).send(query['hub.challenge']);
  }
  @Post() async webhook(@Req() req: Request & { rawBody?: Buffer }, @Body() body: any) {
    const secret = process.env.META_APP_SECRET;
    if (
      !secret ||
      !req.rawBody ||
      !signed(req.rawBody, (req.get('x-hub-signature-256') || '').replace(/^sha256=/, ''), secret)
    )
      throw new ForbiddenException('Invalid Meta signature');
    if (body.object !== 'instagram') return { received: true };
    for (const entry of (body.entry || []).slice(0, 100)) {
      const account = await this.db.connectedSocialAccount.findUnique({
        where: { externalId: String(entry.id) },
      });
      if (!account || account.status !== 'CONNECTED') continue;
      for (const change of (entry.changes || []).slice(0, 100)) {
        const v = change.value;
        if (
          change.field !== 'comments' ||
          !v?.id ||
          !v?.text ||
          !v.media?.id ||
          !entry.time ||
          v.media.media_product_type === 'LIVE'
        )
          continue;
        if (v.from?.id === account.externalId) continue;
        await this.db.automationEvent.upsert({
          where: { dedupeKey: `instagram:${account.externalId}:${v.id}` },
          create: {
            dedupeKey: `instagram:${account.externalId}:${v.id}`,
            workspaceId: account.workspaceId,
            accountExternalId: account.externalId,
            commentId: String(v.id),
            mediaId: String(v.media.id),
            text: String(v.text).slice(0, 5000),
            occurredAt: new Date(Number(entry.time) * 1000),
          },
          update: {},
        });
      }
    }
    return { received: true };
  }
}
