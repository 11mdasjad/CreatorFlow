import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { spawn, ChildProcess } from 'node:child_process';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Db, hash } from '../src/core';
import { createApp } from '../src/main';
import { runWorkflows } from '../src/workflow-engine';
let app: INestApplication, db: Db, pg: ChildProcess | undefined;
const origin = 'http://127.0.0.1:3000',
  pass = 'Correct-horse-battery-2026!';
let seq = 0;
async function account(label: string) {
  const email = `test-${label.toLowerCase()}-${Date.now()}-${++seq}@example.test`;
  await request(app.getHttpServer())
    .post('/api/auth/register')
    .set('Origin', origin)
    .send({ name: label, email, password: pass })
    .expect(201);
  const mail = await db.emailOutbox.findFirstOrThrow({
    where: { to: email },
    orderBy: { createdAt: 'desc' },
  });
  const verification = mail.text.match(/token=([a-f0-9]{64})/)![1];
  await request(app.getHttpServer())
    .post('/api/auth/verify')
    .set('Origin', origin)
    .send({ token: verification })
    .expect(201);
  const result = await request(app.getHttpServer())
    .post('/api/auth/login')
    .set('Origin', origin)
    .send({ email, password: pass })
    .expect(201);
  const cookies = result.headers['set-cookie'] as unknown as string[];
  const csrf = cookies
    .find((c) => c.startsWith('cf_csrf='))!
    .split(';')[0]
    .split('=')[1];
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return { email, user, cookies: cookies.map((c) => c.split(';')[0]).join('; '), csrf };
}
type Account = Awaited<ReturnType<typeof account>>;
function authenticated(a: Account, method: string, path: string, data?: unknown) {
  const r = (request(app.getHttpServer()) as any)
    [method](`/api${path}`)
    .set('Origin', origin)
    .set('Cookie', a.cookies)
    .set('x-csrf-token', a.csrf);
  return data === undefined ? r : r.send(data);
}
async function workspace(a: Account, name: string) {
  const r = await authenticated(a, 'post', '/workspaces', {
    name,
    slug: `test-${name.toLowerCase()}-${Date.now()}-${++seq}`,
  }).expect(201);
  return r.body;
}
beforeAll(async () => {
  process.env.REDIS_URL = '';
  process.env.DATABASE_POOL_MAX = '1';
  process.env.EMAIL_PROVIDER = 'local';
  process.env.META_APP_SECRET = 'integration-test-meta-secret';
  process.env.META_APPROVED = 'false';
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  } else {
    pg = spawn(process.execPath, ['scripts/test-postgres.cjs'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise<void>((resolve, reject) => {
      pg!.stdout!.on('data', (chunk) => {
        if (String(chunk).includes('TEST_DATABASE_READY')) resolve();
      });
      pg!.on('error', reject);
      pg!.on('exit', (code) => {
        if (code) reject(new Error('Test PostgreSQL failed to start'));
      });
    });
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5434/postgres';
  }
  app = await createApp();
  db = app.get(Db);
  await db.subscriptionPlan.upsert({
    where: { name: 'Free Trial' },
    create: {
      name: 'Free Trial',
      limits: { leads: 100, team: 10, accounts: 1, automations: 3, executions: 100, workflows: 3 },
      features: [],
    },
    update: {},
  });
});
afterAll(async () => {
  await app?.close();
  if (pg) {
    pg.kill('SIGTERM');
    await new Promise<void>((resolve) => pg!.on('exit', () => resolve()));
  }
});
describe('Real API and PostgreSQL boundary tests', () => {
  let a: Account, b: Account, wa: any, wb: any, lead: any;
  beforeAll(async () => {
    a = await account('Alice');
    b = await account('Bob');
    wa = await workspace(a, 'Alpha');
    wb = await workspace(b, 'Bravo');
    lead = (
      await authenticated(a, 'post', `/workspaces/${wa.id}/resources/leads`, {
        name: 'Private Lead',
        email: 'private@example.test',
        tags: ['vip'],
      }).expect(201)
    ).body;
  });
  test('requires authentication and origin protection', async () => {
    await request(app.getHttpServer()).get(`/api/workspaces/${wa.id}/resources/leads`).expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'https://attacker.test')
      .send({ email: a.email, password: pass })
      .expect(403);
  });
  test('new workspaces get an active, non-expiring Starter subscription when the free plan is published', async () => {
    const starter = await db.subscriptionPlan.create({
      data: {
        name: 'Starter',
        published: true,
        priceMinor: 0,
        limits: { leads: 100, team: 1, accounts: 1, automations: 3, executions: 100, workflows: 3 },
        features: [],
      },
    });
    let created: { id: string } | undefined;
    try {
      created = await workspace(a, 'FreeStarter');
      const subscription = await db.subscription.findUniqueOrThrow({
        where: { workspaceId: created!.id },
      });
      expect(subscription.planId).toBe(starter.id);
      expect(subscription.status).toBe('ACTIVE');
      expect(subscription.trialEndsAt).toBeNull();
      await authenticated(a, 'post', `/workspaces/${created!.id}/resources/leads`, {
        name: 'First free-plan lead',
        email: 'free-starter-lead@example.test',
      }).expect(201);
    } finally {
      if (created) await db.workspace.delete({ where: { id: created.id } });
      await db.subscriptionPlan.delete({ where: { id: starter.id } });
    }
  });
  test('blocks unverified workspace creation', async () => {
    const email = `test-unverified-${Date.now()}@example.test`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ name: 'Pending', email, password: pass })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email, password: pass });
    const cookies = login.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Origin', origin)
      .set('Cookie', cookies.map((c) => c.split(';')[0]).join('; '))
      .set(
        'x-csrf-token',
        cookies
          .find((c) => c.startsWith('cf_csrf='))!
          .split(';')[0]
          .split('=')[1],
      )
      .send({ name: 'Denied', slug: 'denied-workspace' })
      .expect(403);
  });
  test('rejects cross-workspace list, read, update, delete and export', async () => {
    await authenticated(b, 'get', `/workspaces/${wa.id}/resources/leads`).expect(403);
    await authenticated(b, 'get', `/workspaces/${wb.id}/resources/leads/${lead.id}`).expect(404);
    await authenticated(b, 'patch', `/workspaces/${wb.id}/resources/leads/${lead.id}`, {
      name: 'Stolen',
    }).expect(404);
    await authenticated(b, 'delete', `/workspaces/${wb.id}/resources/leads/${lead.id}`).expect(404);
    await authenticated(b, 'get', `/workspaces/${wa.id}/export`).expect(403);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).name).toBe('Private Lead');
  });
  test('rejects CSRF on an authenticated write', async () => {
    await request(app.getHttpServer())
      .patch(`/api/workspaces/${wa.id}/resources/leads/${lead.id}`)
      .set('Origin', origin)
      .set('Cookie', a.cookies)
      .send({ name: 'CSRF' })
      .expect(403);
  });
  test('viewer can read but cannot write, invite or export ownership-only data', async () => {
    await db.workspaceMember.create({
      data: { workspaceId: wa.id, userId: b.user.id, role: 'VIEWER' },
    });
    await authenticated(b, 'get', `/workspaces/${wa.id}/resources/leads`).expect(200);
    await authenticated(b, 'post', `/workspaces/${wa.id}/resources/leads`, {
      name: 'Denied',
      email: 'denied@example.test',
    }).expect(403);
    await authenticated(b, 'post', `/workspaces/${wa.id}/team/invite`, {
      email: 'x@example.test',
      role: 'ADMIN',
    }).expect(403);
    await authenticated(b, 'get', `/workspaces/${wa.id}/export`).expect(403);
  });
  test('database foreign keys reject cross-tenant links', async () => {
    const form = await db.leadForm.create({
      data: {
        workspaceId: wb.id,
        name: 'Other form',
        slug: `other-${Date.now()}`,
        consentText: 'Marketing consent',
      },
    });
    await expect(
      db.leadMagnet.create({ data: { workspaceId: wa.id, name: 'Cross tenant', formId: form.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  test('persists lead changes and deduplicates email per workspace', async () => {
    await authenticated(a, 'patch', `/workspaces/${wa.id}/resources/leads/${lead.id}`, {
      status: 'QUALIFIED',
    }).expect(200);
    const response = await authenticated(
      a,
      'get',
      `/workspaces/${wa.id}/resources/leads?status=QUALIFIED`,
    );
    expect(response.body.items[0].status).toBe('QUALIFIED');
    await authenticated(a, 'post', `/workspaces/${wa.id}/resources/leads`, {
      name: 'Duplicate',
      email: 'private@example.test',
    }).expect(409);
    await authenticated(a, 'post', `/workspaces/${wa.id}/leads/${lead.id}/notes`, {
      body: 'Useful context',
    }).expect(201);
    expect(await db.leadNote.count({ where: { leadId: lead.id } })).toBe(1);
  });
  test('captures optional consent without silently opting in', async () => {
    const form = (
      await authenticated(a, 'post', `/workspaces/${wa.id}/resources/forms`, {
        name: 'Guide form',
        slug: `guide-${Date.now()}`,
        description: 'A guide',
        consentText: 'I would like optional marketing emails.',
        published: true,
      }).expect(201)
    ).body;
    await request(app.getHttpServer())
      .post(`/api/public/forms/${form.slug}/submit`)
      .send({ name: 'Audience Member', email: 'audience@example.test', consent: false })
      .expect(201);
    const saved = await db.lead.findUniqueOrThrow({
      where: { workspaceId_email: { workspaceId: wa.id, email: 'audience@example.test' } },
      include: { consents: true },
    });
    expect(saved.consents[0].granted).toBe(false);
    await request(app.getHttpServer())
      .post(`/api/public/forms/${form.slug}/submit`)
      .send({
        name: 'Spam',
        email: 'spam@example.test',
        consent: true,
        website: 'https://spam.test',
      })
      .expect(400);
  });
  test('simulation never creates a successful execution or sends externally', async () => {
    const automation = (
      await authenticated(a, 'post', `/workspaces/${wa.id}/resources/automations`, {
        name: 'Guide automation',
        keywords: ['GUIDE'],
        message: 'Here is your guide.',
        status: 'DRAFT',
      }).expect(201)
    ).body;
    const simulated = await authenticated(
      a,
      'post',
      `/workspaces/${wa.id}/automations/${automation.id}/simulate`,
      { comment: 'guide' },
    ).expect(201);
    expect(simulated.body.mode).toBe('Simulation');
    expect(simulated.body.matched).toBe(true);
    expect(await db.automationExecution.count({ where: { automationId: automation.id } })).toBe(0);
    await authenticated(a, 'patch', `/workspaces/${wa.id}/resources/automations/${automation.id}`, {
      status: 'ACTIVE',
    }).expect(400);
  });
  test('verifies raw Meta signatures and deduplicates incoming events', async () => {
    await db.connectedSocialAccount.create({
      data: {
        workspaceId: wa.id,
        externalId: '123456',
        username: 'test-authorized',
        tokenCiphertext: 'not-a-live-token',
        permissions: [],
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const body = {
      object: 'instagram',
      entry: [
        {
          id: '123456',
          time: Math.floor(Date.now() / 1000),
          changes: [
            {
              field: 'comments',
              value: {
                id: '98765',
                text: 'GUIDE',
                media: { id: 'media1', media_product_type: 'FEED' },
              },
            },
          ],
        },
      ],
    };
    const raw = JSON.stringify(body);
    await request(app.getHttpServer())
      .post('/api/webhooks/meta')
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(403);
    const signature = createHmac('sha256', process.env.META_APP_SECRET!).update(raw).digest('hex');
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post('/api/webhooks/meta')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', `sha256=${signature}`)
        .send(raw)
        .expect(201);
    expect(await db.automationEvent.count({ where: { commentId: '98765' } })).toBe(1);
  });
  test('versioned workflow publishing validates graph and prevents cycles', async () => {
    const graph = {
      nodes: [
        { id: 'a', type: 'leadCreated', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'b', type: 'end', position: { x: 0, y: 100 }, data: { label: 'End' } },
      ],
      edges: [{ id: 'e', source: 'a', target: 'b' }],
    };
    const flow = (
      await authenticated(a, 'post', `/workspaces/${wa.id}/workflows`, {
        name: 'New lead flow',
        graph,
      }).expect(201)
    ).body;
    await authenticated(a, 'post', `/workspaces/${wa.id}/workflows/${flow.id}/publish`, {}).expect(
      201,
    );
    expect(await db.workflowVersion.count({ where: { workflowId: flow.id } })).toBe(1);
    await authenticated(a, 'post', `/workspaces/${wa.id}/workflows`, {
      id: flow.id,
      name: 'New lead flow',
      graph: { ...graph, edges: [...graph.edges, { id: 'cycle', source: 'b', target: 'a' }] },
    }).expect(201);
    await authenticated(a, 'post', `/workspaces/${wa.id}/workflows/${flow.id}/publish`, {}).expect(
      400,
    );
    expect(await db.workflowVersion.count({ where: { workflowId: flow.id } })).toBe(1);
  });
  test('does not grant paid access from frontend claims', async () => {
    const course = await db.course.create({
      data: { workspaceId: wa.id, name: 'Paid course', published: true, free: false },
    });
    const product = await db.product.create({
      data: {
        workspaceId: wa.id,
        name: 'Paid product',
        kind: 'COURSE',
        courseId: course.id,
        priceMinor: 10000,
        published: true,
      },
    });
    await authenticated(a, 'get', `/learn/products/${product.id}/download`).expect(403);
    await authenticated(a, 'post', `/learn/courses/${course.id}/enroll`, {
      paymentSuccess: true,
    }).expect(403);
    await request(app.getHttpServer())
      .post('/api/webhooks/stripe')
      .send({ payment_status: 'paid' })
      .expect(503);
    expect(await db.digitalEntitlement.count({ where: { productId: product.id } })).toBe(0);
  });
  test('returns actual analytics and empty states for a fresh workspace', async () => {
    const analytics = await authenticated(a, 'get', `/workspaces/${wa.id}/analytics`).expect(200);
    expect(analytics.body.leads).toBe(2);
    expect(analytics.body.accepted).toBe(0);
    expect(analytics.body.successRate).toBeNull();
    const empty = await authenticated(b, 'get', `/workspaces/${wb.id}/analytics`).expect(200);
    expect(empty.body.leads).toBe(0);
    expect(empty.body.revenue).toEqual([]);
    expect(empty.body.series).toHaveLength(30);
  });
  test('denies non-admin access', async () => {
    for (const section of [
      'overview',
      'users',
      'workspaces',
      'plans',
      'monitoring',
      'support',
      'settings',
    ]) {
      await request(app.getHttpServer()).get(`/api/admin/${section}`).expect(401);
      await authenticated(a, 'get', `/admin/${section}`).expect(403);
    }
  });
  test('shared login derives the creator role from the database and rejects role injection', async () => {
    const count = await db.session.count({ where: { userId: a.user.id } });
    for (const claim of [{ isSuperAdmin: true }, { portal: 'admin' }]) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ email: a.email, password: pass, ...claim })
        .expect(400);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    expect(await db.session.count({ where: { userId: a.user.id } })).toBe(count);
    const signedIn = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: a.email, password: pass })
      .expect(201);
    expect(signedIn.body.portal).toBe('creator');
    const cookies = (signedIn.headers['set-cookie'] as unknown as string[])
      .map((c) => c.split(';')[0])
      .join('; ');
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('Cookie', cookies)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({
        email: 'role-injection@example.test',
        password: pass,
        name: 'Role injection',
        isSuperAdmin: true,
      })
      .expect(400);
  });
  test('shared login routes verified admins while preserving permissions and session revocation', async () => {
    const admin = await db.user.create({
      data: {
        email: `admin-${Date.now()}@example.test`,
        name: 'Platform Admin',
        passwordHash: a.user.passwordHash,
        isSuperAdmin: true,
      },
    });
    const login = (path: string) =>
      request(app.getHttpServer())
        .post(path)
        .set('Origin', origin)
        .send({ email: admin.email, password: pass });
    const unverified = await login('/api/auth/login').expect(403);
    expect(unverified.headers['set-cookie']).toBeUndefined();
    await db.user.update({ where: { id: admin.id }, data: { verifiedAt: new Date() } });
    const signedIn = await login('/api/auth/login').expect(201);
    expect(signedIn.body.portal).toBe('admin');
    const rawCookies = signedIn.headers['set-cookie'] as unknown as string[];
    const session = {
      email: admin.email,
      user: admin,
      cookies: rawCookies.map((cookie) => cookie.split(';')[0]).join('; '),
      csrf: rawCookies
        .find((cookie) => cookie.startsWith('cf_csrf='))!
        .split(';')[0]
        .split('=')[1],
    };
    for (const section of [
      'overview',
      'users',
      'workspaces',
      'plans',
      'monitoring',
      'support',
      'settings',
    ]) {
      await authenticated(session, 'get', `/admin/${section}`).expect(200);
    }
    await authenticated(session, 'get', `/workspaces/${wa.id}/resources/leads`).expect(403);
    await authenticated(session, 'post', '/admin/settings', {
      key: 'maintenanceBanner',
      value: 'Denied',
      password: pass,
    }).expect(403);
    await db.user.update({ where: { id: admin.id }, data: { isSuperAdmin: false } });
    await authenticated(session, 'get', '/admin/overview').expect(403);
    await db.user.update({ where: { id: admin.id }, data: { isSuperAdmin: true } });
    await authenticated(session, 'post', '/auth/logout', {}).expect(201);
    await authenticated(session, 'get', '/admin/overview').expect(401);
  });
  test('verified Stripe payment webhooks are idempotent and refunds revoke access', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture_only';
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_fixture_only';
    process.env.STRIPE_LIVE_MODE = 'false';
    await db.store.update({
      where: { workspaceId: wa.id },
      data: { stripeAccountId: 'acct_fixture' },
    });
    const product = await db.product.create({
      data: { workspaceId: wa.id, name: 'Fixture download', priceMinor: 2500 },
    });
    const order = await db.order.create({
      data: {
        workspaceId: wa.id,
        email: a.email,
        amountMinor: 2500,
        currency: 'INR',
        checkoutId: 'cs_fixture',
        items: { create: { productId: product.id, name: product.name, priceMinor: 2500 } },
      },
    });
    const event = {
      id: 'evt_fixture_paid',
      object: 'event',
      type: 'checkout.session.completed',
      livemode: false,
      account: 'acct_fixture',
      data: {
        object: {
          id: 'cs_fixture',
          mode: 'payment',
          payment_status: 'paid',
          amount_total: 2500,
          currency: 'inr',
          payment_intent: 'pi_fixture',
        },
      },
    };
    async function hook(value: unknown) {
      const payload = JSON.stringify(value),
        timestamp = Math.floor(Date.now() / 1000);
      const sig = createHmac('sha256', process.env.STRIPE_CONNECT_WEBHOOK_SECRET!)
        .update(`${timestamp}.${payload}`)
        .digest('hex');
      return request(app.getHttpServer())
        .post('/api/webhooks/stripe/connect')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', `t=${timestamp},v1=${sig}`)
        .send(payload);
    }
    expect((await hook({ ...event, account: 'acct_wrong' })).status).toBe(403);
    expect(
      (await hook({ ...event, data: { object: { ...event.data.object, amount_total: 100 } } }))
        .status,
    ).toBe(400);
    expect(await db.digitalEntitlement.count({ where: { orderId: order.id } })).toBe(0);
    expect((await hook(event)).status).toBe(201);
    expect((await hook(event)).status).toBe(201);
    expect(await db.digitalEntitlement.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
    const refund = {
      id: 'evt_fixture_refund',
      object: 'event',
      type: 'charge.refunded',
      livemode: false,
      account: 'acct_fixture',
      data: { object: { id: 'ch_fixture', payment_intent: 'pi_fixture', refunded: true } },
    };
    expect((await hook(refund)).status).toBe(201);
    expect(
      (await db.digitalEntitlement.findFirstOrThrow({ where: { orderId: order.id } })).revokedAt,
    ).not.toBeNull();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  });
  test('workflow executor applies an immutable published graph once', async () => {
    const graph = {
      nodes: [
        { id: 't', type: 'leadCreated', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        {
          id: 'tag',
          type: 'addTag',
          position: { x: 0, y: 50 },
          data: { label: 'Tag lead', value: 'workflow-tested' },
        },
        {
          id: 'n',
          type: 'notification',
          position: { x: 0, y: 100 },
          data: { label: 'Workflow fixture', value: 'Tagged successfully' },
        },
        { id: 'e', type: 'end', position: { x: 0, y: 150 }, data: { label: 'End' } },
      ],
      edges: [
        { id: 'a', source: 't', target: 'tag' },
        { id: 'b', source: 'tag', target: 'n' },
        { id: 'c', source: 'n', target: 'e' },
      ],
    };
    const flow = (
      await authenticated(a, 'post', `/workspaces/${wa.id}/workflows`, {
        name: 'Enrichment fixture',
        graph,
      }).expect(201)
    ).body;
    await authenticated(a, 'post', `/workspaces/${wa.id}/workflows/${flow.id}/publish`, {}).expect(
      201,
    );
    const l = (
      await authenticated(a, 'post', `/workspaces/${wa.id}/resources/leads`, {
        name: 'Workflow fixture lead',
        email: 'workflow@example.test',
      }).expect(201)
    ).body;
    await runWorkflows(db);
    await runWorkflows(db);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).tags).toContain(
      'workflow-tested',
    );
    expect(
      await db.notification.count({ where: { workspaceId: wa.id, title: 'Workflow fixture' } }),
    ).toBe(1);
    expect(
      (
        await db.workflowExecution.findFirstOrThrow({
          where: { leadId: l.id, version: { workflowId: flow.id } },
        })
      ).status,
    ).toBe('COMPLETED');
  });
  test('password reset is single-use and revokes sessions', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .set('Origin', origin)
      .send({ email: a.email })
      .expect(201);
    const mail = await db.emailOutbox.findFirstOrThrow({
      where: { to: a.email, subject: { contains: 'Reset' } },
      orderBy: { createdAt: 'desc' },
    });
    const token = mail.text.match(/token=([a-f0-9]{64})/)![1];
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .set('Origin', origin)
      .send({ token, password: pass + 'new' })
      .expect(201);
    await authenticated(a, 'get', '/auth/me').expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .set('Origin', origin)
      .send({ token, password: pass + 'again' })
      .expect(400);
  });
});
