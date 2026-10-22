import 'reflect-metadata';
import 'dotenv/config';
import { Queue, Worker, UnrecoverableError } from 'bullmq';
import Redis from 'ioredis';
import { sendEmails, validateMailConfig } from './mail';
import { Db, checkConfig, quota, workspaceLock, decrypt, notify, config } from './core';
import { Instagram, MetaError } from './instagram';
import { keywordMatches, Graph } from './schemas';
import { eligibleDate } from './policy';
import { runWorkflows } from './workflow-engine';
checkConfig();
validateMailConfig();
if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required for the worker');
const db = new Db(),
  instagram = new Instagram();
const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('creatorflow-instagram', { connection });
let stopping = false;
async function scheduleEvents() {
  const events = await db.automationEvent.findMany({
    where: { status: 'PENDING' },
    take: 100,
    orderBy: { createdAt: 'asc' },
  });
  for (const event of events)
    await db.$transaction(async (tx) => {
      await workspaceLock(tx, event.workspaceId);
      const current = await tx.automationEvent.findUnique({ where: { id: event.id } });
      if (current?.status !== 'PENDING') return;
      const rules = await tx.automation.findMany({
        where: {
          workspaceId: event.workspaceId,
          status: 'ACTIVE',
          account: { externalId: event.accountExternalId },
          mediaId: event.mediaId,
        },
        orderBy: { createdAt: 'asc' },
      });
      const rule = rules.find((r) => keywordMatches(event.text, r.keywords, r.matchMode));
      if (rule)
        await tx.automationExecution.upsert({
          where: { eventId: event.id },
          create: {
            workspaceId: event.workspaceId,
            automationId: rule.id,
            eventId: event.id,
            version: rule.version,
            message: rule.message,
          },
          update: {},
        });
      await tx.automationEvent.update({
        where: { id: event.id },
        data: { status: rule ? 'MATCHED' : 'IGNORED' },
      });
    });
  const executions = await db.automationExecution.findMany({
    where: { status: 'QUEUED' },
    take: 200,
  });
  for (const item of executions)
    await queue.add(
      'reply',
      { id: item.id },
      {
        jobId: item.id,
        attempts: 4,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: false,
      },
    );
}
const worker = new Worker(
  'creatorflow-instagram',
  async (job) => {
    const row = await db.automationExecution.findUnique({
      where: { id: job.data.id },
      include: { event: true, automation: { include: { account: true, workspace: true } } },
    });
    if (!row || row.status !== 'QUEUED') return;
    const account = row.automation.account;
    if (
      process.env.META_APPROVED !== 'true' ||
      process.env.META_PRIVATE_REPLY_POLICY_VERIFIED !== 'true' ||
      !account ||
      account.status !== 'CONNECTED' ||
      account.expiresAt < new Date() ||
      !account.webhookSubscribed ||
      row.automation.status !== 'ACTIVE' ||
      row.automation.workspace.suspendedAt ||
      !eligibleDate(row.event.occurredAt)
    ) {
      await db.automationExecution.update({
        where: { id: row.id },
        data: { status: 'SKIPPED', errorCode: 'INELIGIBLE' },
      });
      return;
    }
    let commentTimestamp: Date;
    try {
      const comment = await instagram.call(
        `${row.event.commentId}?fields=id,timestamp`,
        decrypt(account.tokenCiphertext),
      );
      commentTimestamp = new Date(comment.timestamp);
      if (
        !comment.timestamp ||
        !Number.isFinite(commentTimestamp.getTime()) ||
        !eligibleDate(commentTimestamp)
      )
        throw new Error('Unverified or expired comment');
      await db.automationEvent.update({
        where: { id: row.eventId },
        data: { occurredAt: commentTimestamp },
      });
    } catch {
      await db.automationExecution.update({
        where: { id: row.id },
        data: { status: 'SKIPPED', errorCode: 'COMMENT_TIMESTAMP_UNVERIFIED' },
      });
      return;
    }
    const rateKey = `meta-rate:${account.externalId}:${Math.floor(Date.now() / 60000)}`;
    const rate = await connection.incr(rateKey);
    await connection.expire(rateKey, 120);
    if (rate > 30) throw new Error('Conservative account rate limit');
    // Persist the send claim before the external call. A crash after this point becomes UNKNOWN, never an automatic duplicate send.
    const claimed = await db.$transaction(async (tx) => {
      await workspaceLock(tx, row.workspaceId);
      await quota(tx, row.workspaceId, 'executions');
      const change = await tx.automationExecution.updateMany({
        where: { id: row.id, status: 'QUEUED' },
        data: { status: 'SENDING', attempts: { increment: 1 } },
      });
      if (!change.count) return false;
      await tx.usageRecord.upsert({
        where: {
          workspaceId_period_metric: {
            workspaceId: row.workspaceId,
            period: new Date().toISOString().slice(0, 7),
            metric: 'executions',
          },
        },
        create: {
          workspaceId: row.workspaceId,
          period: new Date().toISOString().slice(0, 7),
          metric: 'executions',
          count: 1,
        },
        update: { count: { increment: 1 } },
      });
      return true;
    });
    if (!claimed) return;
    try {
      const result = await instagram.privateReply(account, row.event.commentId, row.message);
      await db.automationExecution.update({
        where: { id: row.id },
        data: {
          status: 'ACCEPTED',
          providerMessageId: result.message_id ? String(result.message_id) : null,
        },
      });
    } catch (error) {
      const e = error as MetaError;
      const retryable = e.status === 429 || e.code === 4 || e.code === 32 || e.code === 613;
      const unknown = e.ambiguous || e.status === 0;
      await db.automationExecution.update({
        where: { id: row.id },
        data: {
          status: unknown ? 'UNKNOWN' : retryable ? 'QUEUED' : 'FAILED',
          errorCode: String(e.code || 'NETWORK'),
        },
      });
      if (e.code === 190)
        await db.connectedSocialAccount.update({
          where: { id: account.id },
          data: {
            status: 'REAUTHORIZATION_REQUIRED',
            diagnostic: 'Access token expired or was revoked. Reconnect your account.',
          },
        });
      if (retryable) throw error;
      await notify(
        db,
        row.workspaceId,
        'Automation needs attention',
        unknown
          ? 'A reply has an uncertain outcome. It will not be sent again automatically.'
          : 'Instagram rejected a reply. Check connection permissions and execution history.',
      );
      throw new UnrecoverableError(
        unknown ? 'Uncertain external outcome' : 'Permanent integration error',
      );
    }
  },
  { connection, concurrency: 4, limiter: { max: 10, duration: 1000 } },
);
worker.on('failed', async (job) => {
  if (job && job.attemptsMade >= 4)
    await db.automationExecution
      .updateMany({
        where: { id: job.data.id, status: 'QUEUED' },
        data: { status: 'FAILED', errorCode: 'RETRIES_EXHAUSTED' },
      })
      .catch(() => {});
});
async function tick() {
  if (stopping) return;
  try {
    await connection.set('creatorflow:worker-heartbeat', new Date().toISOString(), 'EX', 60);
    await scheduleEvents();
    await runWorkflows(db);
    await sendEmails(db);
    await db.automationExecution.updateMany({
      where: { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - 300000) } },
      data: { status: 'UNKNOWN', errorCode: 'WORKER_INTERRUPTED' },
    });
    await db.emailOutbox.updateMany({
      where: { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - 300000) } },
      data: { status: 'UNKNOWN', error: 'Worker interrupted; inspect provider before resending' },
    });
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.emailOutbox.deleteMany({
      where: { status: 'SENT', updatedAt: { lt: new Date(Date.now() - 30 * 86400000) } },
    });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', component: 'worker', type: (e as Error).name }));
  } finally {
    if (!stopping) setTimeout(tick, 3000);
  }
}
void tick();
async function stop() {
  stopping = true;
  await worker.close();
  await queue.close();
  await connection.quit();
  await db.$disconnect();
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
