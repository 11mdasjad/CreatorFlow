import 'dotenv/config';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
  createHmac,
} from 'node:crypto';
import { z } from 'zod';
import type { Request, Response } from 'express';
import Redis from 'ioredis';

export const config = {
  production: process.env.NODE_ENV === 'production',
  appUrl: process.env.APP_URL || 'http://127.0.0.1:3000',
  port: Number(process.env.PORT || process.env.API_PORT || 4000),
};
export function checkConfig() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (config.production) {
    for (const key of ['REDIS_URL', 'TOKEN_ENCRYPTION_KEY', 'ADMIN_ACTION_KEY', 'APP_URL'])
      if (!process.env[key]) throw new Error(`${key} is required in production`);
    if (!/^[a-f0-9]{64}$/i.test(process.env.TOKEN_ENCRYPTION_KEY || ''))
      throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters');
    if (
      (process.env.ADMIN_ACTION_KEY || '').length < 32 ||
      process.env.ADMIN_ACTION_KEY?.startsWith('REPLACE_')
    )
      throw new Error('ADMIN_ACTION_KEY must be a strong independently generated secret');
    if (!config.appUrl.startsWith('https://')) throw new Error('Production APP_URL must use HTTPS');
    if (!['ses', 'smtp'].includes(process.env.EMAIL_PROVIDER || ''))
      throw new Error('Production requires an email provider');
  }
}
@Injectable()
export class Db extends PrismaClient {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DATABASE_POOL_MAX || 10),
      }),
    });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
export const token = () => randomBytes(32).toString('hex');
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function signed(raw: Buffer, signature: string, secret: string) {
  return equal(createHmac('sha256', secret).update(raw).digest('hex'), signature);
}
export function encrypt(value: string) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || '', 'hex');
  if (key.length !== 32)
    throw new ServiceUnavailableException('Token encryption requires a 32-byte key');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${body.toString('hex')}`;
}
export function decrypt(value: string) {
  const [iv, tag, body] = value.split('.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || '', 'hex'),
    Buffer.from(iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'hex')), decipher.final()]).toString(
    'utf8',
  );
}
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success)
    throw new BadRequestException({
      message: 'Please check the highlighted fields',
      fields: r.error.flatten(),
    });
  return r.data;
}
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(120).default(''),
});
export type AuthedRequest = Request & {
  user: {
    id: string;
    email: string;
    name: string;
    verifiedAt: Date | null;
    isSuperAdmin: boolean;
    notificationEmail: boolean;
  };
  sessionId: string;
  workspaceId: string;
  role: string;
};
export function checkOrigin(req: Request) {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.get('origin') !== new URL(config.appUrl).origin
  )
    throw new ForbiddenException('Invalid request origin');
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private db: Db) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const sid = req.cookies?.cf_session;
    if (!sid) throw new UnauthorizedException('Please sign in');
    const session = await this.db.session.findUnique({
      where: { tokenHash: hash(sid) },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date() || session.user.suspendedAt)
      throw new UnauthorizedException('Your session has expired');
    checkOrigin(req);
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (!req.get('x-csrf-token') || !equal(hash(req.get('x-csrf-token')!), session.csrfHash))
    )
      throw new ForbiddenException('Invalid CSRF token');
    const { id, email, name, verifiedAt, isSuperAdmin, notificationEmail } = session.user;
    req.user = { id, email, name, verifiedAt, isSuperAdmin, notificationEmail };
    req.sessionId = session.id;
    return true;
  }
}
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private db: Db) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user?.verifiedAt) throw new ForbiddenException('Verify your email first');
    const wid = String(req.params.workspaceId || '');
    const member = await this.db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wid, userId: req.user.id } },
      include: { workspace: true },
    });
    if (!member || member.workspace.suspendedAt)
      throw new ForbiddenException('Workspace access denied');
    req.workspaceId = wid;
    req.role = member.role;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && member.role === 'VIEWER')
      throw new ForbiddenException('Viewer access is read-only');
    const flags = await this.db.systemSetting.findUnique({ where: { key: 'featureFlags' } });
    const capability = req.path.match(/\/resources\/([^/]+)/)?.[1] || req.path.split('/')[4];
    if (
      capability &&
      flags?.value &&
      typeof flags.value === 'object' &&
      (flags.value as Record<string, unknown>)[capability] === false
    )
      throw new ForbiddenException('This feature is disabled by the platform administrator');
    return true;
  }
}
export function requireRole(req: AuthedRequest, roles: string[]) {
  if (!roles.includes(req.role))
    throw new ForbiddenException('Your role does not permit this action');
}
export async function owned<T>(
  db: any,
  model: string,
  workspaceId: string,
  id: string,
): Promise<T> {
  const value = await db[model].findFirst({ where: { workspaceId, id } });
  if (!value) throw new NotFoundException('Record not found');
  return value;
}
export async function audit(
  db: any,
  actorId: string,
  action: string,
  workspaceId?: string,
  targetId?: string,
) {
  return db.auditLog.create({ data: { actorId, action, workspaceId, targetId } });
}
export async function quota(db: any, workspaceId: string, metric: string, current?: number) {
  const sub = await db.subscription.findUnique({ where: { workspaceId }, include: { plan: true } });
  if (
    !sub ||
    !['ACTIVE', 'TRIALING'].includes(sub.status) ||
    (sub.status === 'TRIALING' && sub.trialEndsAt && sub.trialEndsAt < new Date())
  )
    throw new ForbiddenException('An active subscription is required');
  const limits = sub.plan.limits as Record<string, number>;
  const limit = limits[metric] ?? 0;
  const period = new Date().toISOString().slice(0, 7);
  const usage = await db.usageRecord.findUnique({
    where: { workspaceId_period_metric: { workspaceId, period, metric } },
  });
  if ((current ?? usage?.count ?? 0) >= limit)
    throw new ForbiddenException(`Your ${metric} limit has been reached`);
}
export async function workspaceLock(db: any, id: string) {
  await db.$queryRawUnsafe('SELECT id FROM "Workspace" WHERE id = $1 FOR UPDATE', id);
}
export async function notify(db: any, workspaceId: string, title: string, body: string) {
  return db.notification.create({ data: { workspaceId, title, body } });
}
export function csv(rows: Record<string, unknown>[]) {
  const keys = Object.keys(rows[0] || { name: '', email: '' });
  const escape = (v: unknown) =>
    `"${String(v ?? '')
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replace(/"/g, '""')}"`;
  return [
    keys.map(escape).join(','),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(',')),
  ].join('\r\n');
}
@Catch()
export class Errors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = error instanceof HttpException ? error.getStatus() : 500;
    let message: any =
      error instanceof HttpException
        ? error.getResponse()
        : 'Something went wrong. Please try again.';
    if (error.code === 'P2002') {
      status = 409;
      message = 'A record with these details already exists';
    }
    if (error.code === 'P2025') {
      status = 404;
      message = 'Record not found';
    }
    if (error.code === 'P2003') {
      status = 409;
      message = 'This record is referenced by other records';
    }
    if (status >= 500)
      console.error(
        JSON.stringify({
          level: 'error',
          type: error.name,
          code: error.code || 'internal',
          requestId: res.getHeader('x-request-id'),
        }),
      );
    res.status(status).json({
      error: typeof message === 'string' ? { message } : message,
      requestId: res.getHeader('x-request-id'),
    });
  }
}
export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  : null;
redis?.on('error', () => {});
const counters = new Map<string, { n: number; expires: number }>();
export async function rateLimit(key: string, limit = 60, seconds = 60) {
  let count: number;
  if (redis) {
    try {
      const bucket = `rate:${key}:${Math.floor(Date.now() / (seconds * 1000))}`;
      const results = await redis.multi().incr(bucket).expire(bucket, seconds).exec();
      count = Number(results?.[0][1]);
    } catch {
      if (config.production) throw new ServiceUnavailableException('Rate limiting unavailable');
      count = local();
    }
  } else count = local();
  function local() {
    const now = Date.now();
    for (const [k, v] of counters) if (v.expires < now) counters.delete(k);
    const row = counters.get(key) || { n: 0, expires: now + seconds * 1000 };
    row.n++;
    counters.set(key, row);
    return row.n;
  }
  if (count > limit) throw new HttpException('Too many requests. Please try again shortly.', 429);
}
