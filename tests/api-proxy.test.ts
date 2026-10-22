import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { proxyApiRequest } from '../apps/web/lib/api-proxy';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ['CREATORFLOW_API_URL', 'API_INTERNAL_URL', 'VERCEL']) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test('reads the binding at request time and preserves its base path and query', async () => {
  process.env.VERCEL = '1';
  for (const base of ['https://api.internal/first/', 'https://api.internal/second']) {
    process.env.CREATORFLOW_API_URL = base;
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), `${base.replace(/\/$/, '')}/api/workspaces?page=2&search=a%2Bb`);
      assert.equal(options?.cache, 'no-store');
      return Response.json({ ok: true });
    };
    const response = await proxyApiRequest(
      new Request('https://creatorflow.test/api/workspaces?page=2&search=a%2Bb'),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('forwards exact webhook bytes, signatures, origin, session and CSRF headers', async () => {
  process.env.CREATORFLOW_API_URL = 'http://api.internal';
  const body = '{ "id": 123, "text": "नमस्ते" }\n';
  globalThis.fetch = async (_url, options) => {
    assert.equal(options?.method, 'POST');
    assert.equal(await new Response(options?.body).text(), body);
    const headers = new Headers(options?.headers);
    assert.equal(headers.get('stripe-signature'), 'signed-body');
    assert.equal(headers.get('cookie'), 'cf_session=session');
    assert.equal(headers.get('x-csrf-token'), 'csrf');
    assert.equal(headers.get('origin'), 'https://creatorflow.test');
    assert.equal(headers.get('host'), null);
    assert.equal(headers.get('connection'), null);
    assert.equal(headers.get('x-hop-only'), null);
    return new Response(null, { status: 204 });
  };
  const response = await proxyApiRequest(
    new Request('https://creatorflow.test/api/webhooks/stripe', {
      method: 'POST',
      body,
      headers: {
        'stripe-signature': 'signed-body',
        cookie: 'cf_session=session',
        'x-csrf-token': 'csrf',
        origin: 'https://creatorflow.test',
        host: 'creatorflow.test',
        connection: 'x-hop-only',
        'x-hop-only': 'remove',
      },
    }),
  );
  assert.equal(response.status, 204);
});

test('preserves separate session and CSRF Set-Cookie headers', async () => {
  process.env.CREATORFLOW_API_URL = 'http://api.internal';
  const cookies = [
    'cf_session=a; Path=/; HttpOnly; Secure; Expires=Wed, 21 Oct 2026 07:28:00 GMT',
    'cf_csrf=b; Path=/; Secure',
  ];
  globalThis.fetch = async () => {
    const headers = new Headers();
    cookies.forEach((cookie) => headers.append('set-cookie', cookie));
    return Response.json({ user: 'creator' }, { headers });
  };
  const response = await proxyApiRequest(
    new Request('https://creatorflow.test/api/auth/login', { method: 'POST', body: '{}' }),
  );
  assert.deepEqual(response.headers.getSetCookie(), cookies);
});

test('returns redirects to the browser instead of following them internally', async () => {
  process.env.CREATORFLOW_API_URL = 'http://api.internal';
  globalThis.fetch = async (_url, options) => {
    assert.equal(options?.redirect, 'manual');
    return new Response(null, {
      status: 302,
      headers: { location: 'https://creatorflow.test/app' },
    });
  };
  const response = await proxyApiRequest(
    new Request('https://creatorflow.test/api/integrations/instagram/callback?code=test'),
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://creatorflow.test/app');
});

test('preserves upstream authorization failures and decoded response bodies', async () => {
  process.env.CREATORFLOW_API_URL = 'http://api.internal';
  globalThis.fetch = async () =>
    Response.json(
      { error: 'Forbidden' },
      {
        status: 403,
        headers: {
          'content-encoding': 'gzip',
          'content-length': '999',
          'transfer-encoding': 'chunked',
        },
      },
    );
  const response = await proxyApiRequest(new Request('https://creatorflow.test/api/admin'));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('content-encoding'), null);
  assert.equal(response.headers.get('content-length'), null);
  assert.deepEqual(await response.json(), { error: 'Forbidden' });
});

test('does not use localhost or manually configured URLs when a Vercel binding is missing', async () => {
  process.env.VERCEL = '1';
  delete process.env.CREATORFLOW_API_URL;
  process.env.API_INTERNAL_URL = 'http://must-not-be-used';
  globalThis.fetch = async () => {
    throw new Error('Must not fetch');
  };
  const response = await proxyApiRequest(new Request('https://creatorflow.test/api/health'));
  assert.equal(response.status, 503);
});

test('retains local and Docker runtime API configuration outside Vercel', async () => {
  delete process.env.VERCEL;
  delete process.env.CREATORFLOW_API_URL;
  for (const configured of [undefined, 'http://api:4000']) {
    if (configured) process.env.API_INTERNAL_URL = configured;
    else delete process.env.API_INTERNAL_URL;
    globalThis.fetch = async (url) => {
      assert.equal(String(url), `${configured || 'http://127.0.0.1:4000'}/api/health`);
      return Response.json({ status: 'ok' });
    };
    assert.equal(
      (await proxyApiRequest(new Request('http://localhost:3000/api/health'))).status,
      200,
    );
  }
});

test('returns a generic 502 without leaking the bound URL or internal errors', async () => {
  process.env.CREATORFLOW_API_URL = 'http://private.internal';
  globalThis.fetch = async () => {
    throw new Error('internal credentials');
  };
  const response = await proxyApiRequest(new Request('https://creatorflow.test/api/health'));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private|credentials/);
});

test('HEAD responses have no body and retain upstream status', async () => {
  process.env.CREATORFLOW_API_URL = 'http://api.internal';
  globalThis.fetch = async (_url, options) => {
    assert.equal(options?.method, 'HEAD');
    assert.equal(options?.body, undefined);
    return new Response(null, { status: 200 });
  };
  const response = await proxyApiRequest(
    new Request('https://creatorflow.test/api/health', { method: 'HEAD' }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.body, null);
});
