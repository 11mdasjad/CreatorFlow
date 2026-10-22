const hopByHopHeaders = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

function forwardedHeaders(source: Headers) {
  const headers = new Headers(source);
  for (const name of (headers.get('connection') || '').split(',')) {
    if (name.trim()) headers.delete(name.trim());
  }
  for (const name of hopByHopHeaders) headers.delete(name);
  headers.delete('host');
  headers.delete('content-length');
  return headers;
}

export async function proxyApiRequest(request: Request): Promise<Response> {
  // Read per request: Vercel injects this binding at runtime, not at build time.
  const base =
    process.env.CREATORFLOW_API_URL ||
    (!process.env.VERCEL ? process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000' : undefined);
  if (!base) {
    return Response.json(
      { error: { message: 'API service binding is not configured.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const incoming = new URL(request.url);
    if (incoming.pathname !== '/api' && !incoming.pathname.startsWith('/api/')) {
      return new Response(null, { status: 404 });
    }
    // Keep the API's existing /api prefix, query string, and any binding base path.
    const target = new URL(
      incoming.pathname.slice(1) + incoming.search,
      base.endsWith('/') ? base : `${base}/`,
    );
    const headers = forwardedHeaders(request.headers);
    headers.set('accept-encoding', 'identity');
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const options: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      ...(hasBody && request.body ? { duplex: 'half' as const } : {}),
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    };
    // Streaming preserves signed webhook bytes; never parse and reserialize the body.
    const upstream = await fetch(target, options);
    const responseHeaders = forwardedHeaders(upstream.headers);
    // fetch transparently decompresses upstream responses.
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('set-cookie');
    for (const cookie of upstream.headers.getSetCookie())
      responseHeaders.append('set-cookie', cookie);
    responseHeaders.set('Cache-Control', 'no-store');
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { error: { message: 'Cannot reach CreatorFlow. Please try again shortly.' } },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
