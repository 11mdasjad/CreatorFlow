import { proxyApiRequest } from '@/lib/api-proxy';

// Bindings are available only inside runtime functions, never next.config or middleware.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = proxyApiRequest;
export const POST = proxyApiRequest;
export const PUT = proxyApiRequest;
export const PATCH = proxyApiRequest;
export const DELETE = proxyApiRequest;
export const HEAD = proxyApiRequest;
export const OPTIONS = proxyApiRequest;
