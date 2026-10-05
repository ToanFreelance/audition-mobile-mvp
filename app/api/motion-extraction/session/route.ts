import { NextResponse } from 'next/server';
import { authorized, cookieName, enabled, equal, sameOrigin, session } from '@/lib/motion-extraction/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { return Response.json({ enabled: enabled(), authorized: await authorized() }, { headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(request: Request) {
  if (!enabled()) return Response.json({ error: 'TOOL_DISABLED' }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ error: 'ORIGIN_REJECTED' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: 'BODY_LIMIT' }, { status: 413 });
    const value: unknown = JSON.parse(raw);
    const token = typeof value === 'object' && value !== null && 'token' in value ? value.token : null;
    if (typeof token !== 'string' || !equal(token, process.env.MOTION_TOOL_TOKEN ?? '')) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const response = NextResponse.json({ authorized: true });
    response.cookies.set(cookieName, session(), { httpOnly: true, sameSite: 'strict', secure: new URL(request.url).protocol === 'https:', path: '/api/motion-extraction', maxAge: 8 * 3600 });
    return response;
  } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }
}
