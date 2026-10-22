import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response, Request } from 'express';
import * as argon2 from 'argon2';
import { z } from 'zod';
import {
  Db,
  AuthGuard,
  AuthedRequest,
  config,
  parse,
  token,
  hash,
  checkOrigin,
  rateLimit,
  audit,
} from './core';
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12, 'Use at least 12 characters').max(128);
export async function queueMail(db: any, to: string, subject: string, text: string) {
  return db.emailOutbox.create({ data: { to, subject, text } });
}
async function issueToken(db: any, userId: string, purpose: string) {
  const value = token();
  await db.authToken.create({
    data: { userId, purpose, tokenHash: hash(value), expiresAt: new Date(Date.now() + 3600000) },
  });
  return value;
}
const verificationSubject = 'Verify your CreatorFlow email';
function mailStatus() {
  return !process.env.EMAIL_PROVIDER || process.env.EMAIL_PROVIDER === 'local' ? 'local' : 'email';
}
async function verificationMail(db: any, user: { id: string; name: string; email: string }) {
  const t = await issueToken(db, user.id, 'VERIFY');
  await queueMail(db, user.email, verificationSubject,
    `Hi ${user.name},\n\nWelcome to CreatorFlow! Confirm your email address to get started.\n\n${config.appUrl}/verify?token=${t}\n\nThis link expires in one hour and can be used once. After verification, sign in and create your workspace.\n\nIf you did not create this account, you can ignore this email.`);
}
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private db: Db) {}
  @Post('register') async register(@Req() req: Request, @Body() input: unknown) {
    checkOrigin(req);
    await rateLimit(`register:${req.ip}`, 5, 900);
    const b = parse(
      z.object({ email, password, name: z.string().trim().min(2).max(80) }).strict(),
      input,
    );
    if (await this.db.user.findUnique({ where: { email: b.email }, select: { id: true } }))
      throw new ConflictException('An account with this email already exists. Sign in, reset your password, or resend the verification email.');
    const passwordHash = await argon2.hash(b.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: b.email, name: b.name, passwordHash } });
      await verificationMail(tx, user);
    });
    return {
      message: 'Your account is created. Open the verification email, confirm your address, then sign in to set up your workspace.',
      delivery: mailStatus(),
    };
  }
  @Post('resend-verification') async resend(@Req() req: Request, @Body() input: unknown) {
    checkOrigin(req);
    await rateLimit(`verify-resend:${req.ip}`, 10, 900);
    const b = parse(z.object({ email }).strict(), input);
    await rateLimit(`verify-resend-email:${hash(b.email)}`, 1, 60);
    await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`verify:${b.email}`}))`;
      const user = await tx.user.findUnique({ where: { email: b.email } });
      if (!user || user.verifiedAt || user.suspendedAt) return;
      const latest = await tx.authToken.findFirst({ where: { userId: user.id, purpose: 'VERIFY' }, orderBy: { createdAt: 'desc' } });
      if (latest && latest.createdAt > new Date(Date.now() - 60000)) return;
      await tx.authToken.deleteMany({ where: { userId: user.id, purpose: 'VERIFY' } });
      await tx.emailOutbox.updateMany({ where: { to: user.email, subject: verificationSubject, status: 'PENDING' }, data: { status: 'CANCELLED', error: 'Replaced by a newer verification email' } });
      await verificationMail(tx, user);
    });
    return { message: 'If this address has an unverified account, a verification email is queued. Check your inbox and spam folder; use the newest link.', delivery: mailStatus() };
  }
  @Post('login') async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() input: unknown,
  ) {
    checkOrigin(req);
    await rateLimit(`login:${req.ip}`, 12, 900);
    const b = parse(z.object({ email, password: z.string().max(128) }).strict(), input);
    await rateLimit(`login-email:${hash(b.email)}`, 12, 900);
    const user = await this.db.user.findUnique({ where: { email: b.email } });
    const dummy =
      '$argon2id$v=19$m=65536,t=3,p=1$MDEyMzQ1Njc4OWFiY2RlZg$Y2Py1Nwo9Mw4EU78mWJ2JI3BZ9lXx2CkzxPRLbhdxVk';
    const valid = await argon2.verify(user?.passwordHash || dummy, b.password).catch(() => false);
    if (!user || !valid || user.suspendedAt)
      throw new UnauthorizedException('Email or password is incorrect');
    // The account's stored role determines its destination, never a client claim.
    // Admin endpoints independently enforce authorization on every request.
    if (user.isSuperAdmin && !user.verifiedAt)
      throw new ForbiddenException(
        'Verify your email before signing in to administer the platform.',
      );
    const portal = user.isSuperAdmin ? 'admin' : 'creator';
    const sid = token(),
      csrf = token();
    const expiresAt = new Date(Date.now() + Number(process.env.SESSION_DAYS || 7) * 86400000);
    await this.db.session.create({
      data: { tokenHash: hash(sid), csrfHash: hash(csrf), userId: user.id, expiresAt },
    });
    const opts = {
      secure: config.production,
      sameSite: 'lax' as const,
      path: '/',
      expires: expiresAt,
    };
    res.cookie('cf_session', sid, { ...opts, httpOnly: true });
    res.cookie('cf_csrf', csrf, { ...opts, httpOnly: false });
    await audit(this.db, user.id, portal === 'admin' ? 'ADMIN_LOGIN' : 'AUTH_LOGIN');
    return {
      user: { id: user.id, name: user.name, email: user.email, verifiedAt: user.verifiedAt },
      portal,
      nextPath: user.isSuperAdmin ? '/admin' : (await this.db.workspaceMember.count({ where: { userId: user.id } })) ? '/app' : '/onboarding',
    };
  }
  @Post('verify') async verify(@Req() req: Request, @Body() input: unknown) {
    checkOrigin(req);
    await rateLimit(`verify:${req.ip}`, 30, 900);
    const b = parse(z.object({ token: z.string().length(64) }), input);
    await this.db.$transaction(async (tx) => {
      const t = await tx.authToken.findUnique({ where: { tokenHash: hash(b.token) } });
      if (!t || t.purpose !== 'VERIFY' || t.expiresAt < new Date())
        throw new BadRequestException('This verification link is invalid or expired');
      const claimed = await tx.authToken.deleteMany({ where: { id: t.id } });
      if (claimed.count !== 1) throw new BadRequestException('Link already used');
      const user = await tx.user.update({ where: { id: t.userId }, data: { verifiedAt: new Date() } });
      await tx.authToken.deleteMany({ where: { userId: user.id, purpose: 'VERIFY' } });
      await queueMail(tx, user.email, 'Welcome to CreatorFlow — your email is verified',
        `Hi ${user.name},\n\nYour email is verified. Your next step is to sign in and create your workspace.\n\n${config.appUrl}/login\n\n1. Give your workspace a name.\n2. Review your starting plan.\n3. Connect Instagram when you are ready, or skip for now.\n4. Create your first product, lead form or automation.\n\nYour progress is saved as you go.`);
    });
    return { message: 'Email verified. You can now create your workspace.' };
  }
  @Post('forgot-password') async forgot(@Req() req: Request, @Body() input: unknown) {
    checkOrigin(req);
    await rateLimit(`forgot:${req.ip}`, 5, 900);
    const b = parse(z.object({ email }), input);
    await rateLimit(`forgot-email:${hash(b.email)}`, 3, 900);
    const user = await this.db.user.findUnique({ where: { email: b.email } });
    if (user)
      await this.db.$transaction(async (tx) => {
        const t = await issueToken(tx, user.id, 'RESET');
        await queueMail(
          tx,
          user.email,
          'Reset your CreatorFlow password',
          `Hi ${user.name},\n\nWe received a request to reset your CreatorFlow password.\n\n${config.appUrl}/reset-password?token=${t}\n\nThis link expires in one hour and can be used once. If you did not request a reset, ignore this email. Your password will stay the same.`,
        );
      });
    return { message: 'If an account exists, a password reset link has been queued. Check your inbox and spam folder.', delivery: mailStatus() };
  }
  @Post('reset-password') async reset(@Req() req: Request, @Body() input: unknown) {
    checkOrigin(req);
    await rateLimit(`reset:${req.ip}`, 10, 900);
    const b = parse(z.object({ token: z.string().length(64), password }), input);
    const passwordHash = await argon2.hash(b.password);
    await this.db.$transaction(async (tx) => {
      const t = await tx.authToken.findUnique({ where: { tokenHash: hash(b.token) } });
      if (!t || t.purpose !== 'RESET' || t.expiresAt < new Date())
        throw new BadRequestException('This reset link is invalid or expired');
      const claimed = await tx.authToken.deleteMany({ where: { id: t.id } });
      if (claimed.count !== 1) throw new BadRequestException('Link already used');
      const user = await tx.user.update({ where: { id: t.userId }, data: { passwordHash } });
      await tx.authToken.deleteMany({ where: { userId: t.userId, purpose: 'RESET' } });
      await tx.session.deleteMany({ where: { userId: t.userId } });
      await queueMail(tx, user.email, 'Your CreatorFlow password was changed',
        `Hi ${user.name},\n\nYour password was changed and all existing sessions were signed out.\n\n${config.appUrl}/login\n\nIf this was not you, use Forgot password on the sign-in page to secure your account immediately.`);
    });
    return { message: 'Password updated. Please sign in again.' };
  }
  @Get('me') @UseGuards(AuthGuard) async me(@Req() req: AuthedRequest) {
    const memberships = await this.db.workspaceMember.findMany({
      where: { userId: req.user.id },
      include: { workspace: true },
    });
    return { user: req.user, memberships };
  }
  @Post('logout') @UseGuards(AuthGuard) async logout(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.db.session.deleteMany({ where: { id: req.sessionId } });
    res.clearCookie('cf_session', { path: '/' });
    res.clearCookie('cf_csrf', { path: '/' });
    return { ok: true };
  }
  @Patch('profile') @UseGuards(AuthGuard) async profile(
    @Req() req: AuthedRequest,
    @Body() input: unknown,
  ) {
    const b = parse(
      z.object({ name: z.string().trim().min(2).max(80), notificationEmail: z.boolean() }).strict(),
      input,
    );
    await this.db.user.update({ where: { id: req.user.id }, data: b });
    return { ok: true };
  }
  @Get('export') @UseGuards(AuthGuard) async export(@Req() req: AuthedRequest) {
    return {
      user: req.user,
      memberships: await this.db.workspaceMember.findMany({
        where: { userId: req.user.id },
        select: { role: true, createdAt: true, workspace: { select: { name: true, id: true } } },
      }),
    };
  }
  @Delete('account') @UseGuards(AuthGuard) async remove(
    @Req() req: AuthedRequest,
    @Body() input: unknown,
  ) {
    const b = parse(
      z.object({ password: z.string().max(128), confirmation: z.literal('DELETE') }),
      input,
    );
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.user.id } });
    if (!(await argon2.verify(user.passwordHash, b.password)))
      throw new ForbiddenException('Incorrect password');
    if (await this.db.workspaceMember.count({ where: { userId: req.user.id, role: 'OWNER' } }))
      throw new BadRequestException(
        'Delete or transfer ownership of your workspaces before deleting your account',
      );
    await this.db.user.delete({ where: { id: req.user.id } });
    return { ok: true };
  }
}
