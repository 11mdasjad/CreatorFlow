import nodemailer from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { Db, config, hash } from './core';

export type Mail = { id: string; to: string; subject: string; text: string };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function renderMail(mail: Pick<Mail, 'subject' | 'text'>) {
  const base = new URL(config.appUrl);
  const urls = mail.text.match(/https?:\/\/[^\s<>]+/g) || [];
  const action = urls.find(value => { try { return new URL(value).origin === base.origin; } catch { return false; } });
  const label = action?.includes('/verify?') ? 'Verify email address' : action?.includes('/reset-password?') ? 'Reset password' : action?.includes('/invite?') ? 'View invitation' : 'Continue to CreatorFlow';
  const paragraphs = mail.text.split(/\n\n/).map(part => `<p style="margin:0 0 18px;color:#46516b;font-size:16px;line-height:1.65">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(mail.subject)}</title></head><body style="margin:0;background:#f3f5fc;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(mail.subject)} — Your next step with CreatorFlow.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:white;border:1px solid #e1e6f3;border-radius:20px"><tr><td style="padding:30px 30px 22px;border-bottom:1px solid #edf0f8"><a href="${escapeHtml(base.origin)}" style="font-size:25px;font-weight:800;color:#17213c;text-decoration:none">Creator<span style="color:#6544e7">Flow</span></a></td></tr><tr><td style="padding:30px"><h1 style="margin:0 0 22px;font-size:26px;line-height:1.3;color:#192442">${escapeHtml(mail.subject)}</h1>${paragraphs}${action ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#5140df"><a href="${escapeHtml(action)}" style="display:inline-block;padding:16px 24px;color:#fff;font-size:16px;font-weight:700;text-decoration:none">${label} →</a></td></tr></table><p style="color:#768099;font-size:12px;line-height:1.6;margin:22px 0 0;word-break:break-all">Button not working? Copy this link into your browser:<br>${escapeHtml(action)}</p>` : ''}</td></tr><tr><td style="padding:22px 30px;background:#fafbff;border-radius:0 0 20px 20px;color:#6c7690;font-size:12px;line-height:1.7">CreatorFlow · Turn your audience into customers.<br>This is an account or service email. We will never ask you to send your password by email.</td></tr></table></td></tr></table></body></html>`;
}
export function validateMailConfig() {
  const provider = process.env.EMAIL_PROVIDER || 'local';
  if (provider === 'local') return;
  if (!['smtp', 'ses'].includes(provider)) throw new Error('EMAIL_PROVIDER must be local, smtp, or ses');
  const from = process.env.EMAIL_FROM || '';
  if (!from.includes('@') || /example\.(com|test)|creatorflow\.local/.test(from)) throw new Error('Configure EMAIL_FROM with your verified sender address');
  if (provider === 'smtp') {
    const url = new URL(process.env.SMTP_URL || '');
    if (!['smtp:', 'smtps:'].includes(url.protocol)) throw new Error('Configure a valid SMTP_URL');
  }
  if (provider === 'ses' && !process.env.AWS_REGION) throw new Error('AWS_REGION is required for SES');
}
export function smtpTransport() {
  const url = new URL(process.env.SMTP_URL!);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return nodemailer.createTransport({
    host: url.hostname, port: Number(url.port || (url.protocol === 'smtps:' ? 465 : 587)),
    secure: url.protocol === 'smtps:', requireTLS: !local && url.protocol !== 'smtps:',
    auth: url.username ? { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) } : undefined,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    disableFileAccess: true, disableUrlAccess: true,
  });
}
export function createMailDelivery(): (mail: Mail) => Promise<void> {
  validateMailConfig();
  if (process.env.EMAIL_PROVIDER === 'smtp') {
    const transport = smtpTransport();
    return async mail => {
      const result = await transport.sendMail({ from: process.env.EMAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: renderMail(mail), messageId: `<${mail.id}@${new URL(config.appUrl).hostname}>` });
      if (!result.accepted.length) throw Object.assign(new Error('Recipient rejected'), { responseCode: 550 });
    };
  }
  const ses = new SESv2Client({ region: process.env.AWS_REGION });
  return async mail => {
    const result = await ses.send(new SendEmailCommand({
      FromEmailAddress: process.env.EMAIL_FROM, Destination: { ToAddresses: [mail.to] },
      Content: { Simple: { Subject: { Data: mail.subject, Charset: 'UTF-8' }, Body: { Text: { Data: mail.text, Charset: 'UTF-8' }, Html: { Data: renderMail(mail), Charset: 'UTF-8' } } } },
    }));
    if (!result.MessageId) throw Object.assign(new Error('Provider acceptance unknown'), { code: 'ETIMEDOUT' });
  };
}
export function mailFailure(error: any, attempts: number) {
  const code = String(error?.code || error?.name || '');
  if (['ETIMEDOUT', 'ESOCKET', 'ECONNRESET', 'TimeoutError', 'RequestTimeout'].includes(code))
    return { status: 'UNKNOWN', error: 'Delivery outcome uncertain; inspect provider before resending' };
  const rejected = Number(error?.responseCode) >= 500 || ['EAUTH', 'MessageRejected', 'MailFromDomainNotVerifiedException', 'NotFoundException'].includes(code);
  return { status: rejected || attempts >= 5 ? 'FAILED' : 'PENDING', error: rejected ? 'Provider rejected email; check sender, credentials and recipient' : 'Temporary provider failure; retry scheduled' };
}
export async function sendEmails(db: Db, deliver?: (mail: Mail) => Promise<void>) {
  if (!deliver && (!process.env.EMAIL_PROVIDER || process.env.EMAIL_PROVIDER === 'local')) return;
  const send = deliver || createMailDelivery();
  await db.emailOutbox.updateMany({ where: { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - 300000) } }, data: { status: 'UNKNOWN', error: 'Worker interrupted; inspect provider before resending' } });
  const since = process.env.EMAIL_DELIVERY_SINCE;
  const emails = await db.emailOutbox.findMany({ where: { status: 'PENDING', nextAttemptAt: { lte: new Date() }, ...(since ? { createdAt: { gte: new Date(since) } } : {}) }, take: 20, orderBy: { createdAt: 'asc' } });
  for (const email of emails) {
    const claimed = await db.emailOutbox.updateMany({ where: { id: email.id, status: 'PENDING' }, data: { status: 'SENDING', attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    const link = email.text.match(/\/(verify|reset-password)\?token=([a-f0-9]{64})/);
    if (link) {
      const authToken = await db.authToken.findUnique({ where: { tokenHash: hash(link[2]) } });
      if (!authToken || authToken.expiresAt <= new Date()) {
        await db.emailOutbox.update({ where: { id: email.id }, data: { status: 'CANCELLED', error: 'Account link expired or was already used' } });
        continue;
      }
    }
    try {
      await send(email);
    } catch (error) {
      await db.emailOutbox.update({ where: { id: email.id }, data: { ...mailFailure(error, email.attempts + 1), nextAttemptAt: new Date(Date.now() + 2 ** email.attempts * 60000) } });
      continue;
    }
    // Keep persistence outside the send catch: a database failure after provider
    // acceptance must never schedule a duplicate delivery.
    await db.emailOutbox.update({ where: { id: email.id }, data: { status: 'SENT', error: null } });
  }
}
