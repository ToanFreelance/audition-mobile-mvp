import { authorized, enabled, sameOrigin } from '@/lib/motion-extraction/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
async function proxy(request: Request, context: Context) {
  if (!enabled()) return Response.json({ error: 'TOOL_DISABLED' }, { status: 404 });
  if (!await authorized()) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (request.method !== 'GET' && !sameOrigin(request)) return Response.json({ error: 'ORIGIN_REJECTED' }, { status: 403 });
  const path = (await context.params).path.join('/');
  const read = /^(health|jobs\/[a-f0-9]{32}(\/files\/[a-zA-Z0-9.-]+)?)$/;
  const write = /^jobs(\/[a-f0-9]{32}\/(analyze|review|extract))?$/;
  if (!(request.method === 'GET' ? read : write).test(path)) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  const base = process.env.MOTION_WORKER_URL; const token = process.env.MOTION_WORKER_TOKEN;
  if (!base || !token) return Response.json({ error: 'WORKER_NOT_CONFIGURED' }, { status: 503 });
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  for (const name of ['content-type', 'content-length', 'x-filename', 'range']) {
    const value = request.headers.get(name); if (value) headers.set(name, value);
  }
  const length = Number(headers.get('content-length') ?? 0);
  if (request.method === 'POST' && (!Number.isFinite(length) || length > (path === 'jobs' ? 256 * 1024 * 1024 : 262144))) return Response.json({ error: 'BODY_LIMIT' }, { status: 413 });
  try {
    const init: RequestInit & { duplex?: 'half' } = { method: request.method, headers, cache: 'no-store', signal: AbortSignal.timeout(120000) };
    if (request.method === 'POST') { init.body = request.body; init.duplex = 'half'; }
    const response = await fetch(`${base.replace(/\/$/, '')}/${path}`, init);
    const out = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    for (const name of ['content-type', 'content-length', 'content-disposition', 'content-range', 'accept-ranges']) {
      const value = response.headers.get(name); if (value) out.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers: out });
  } catch { return Response.json({ error: 'WORKER_UNAVAILABLE' }, { status: 503 }); }
}
export const GET = proxy;
export const POST = proxy;
