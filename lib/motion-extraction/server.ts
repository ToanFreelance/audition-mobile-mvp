import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const cookieName = 'astra-motion-owner';
export const enabled = () => process.env.MOTION_TOOL_ENABLED === '1' && (process.env.MOTION_TOOL_TOKEN?.length ?? 0) >= 16;
export function equal(a: string, b: string) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function sign(value: string) { return createHmac('sha256', process.env.MOTION_TOOL_TOKEN ?? '').update(value).digest('hex'); }
export function session() { const expires = String(Date.now() + 8 * 3600_000); return `${expires}.${sign(expires)}`; }
export async function authorized() {
  if (!enabled()) return false;
  const value = (await cookies()).get(cookieName)?.value ?? '';
  const [expires, signature] = value.split('.');
  return Number(expires) > Date.now() && Number(expires) < Date.now() + 9 * 3600_000 && !!signature && equal(signature, sign(expires));
}
export function sameOrigin(request: Request) {
  const url = new URL(request.url);
  const expected = process.env.MOTION_TOOL_ORIGIN ?? `${url.protocol}//${request.headers.get('host') ?? url.host}`;
  return request.headers.get('origin') === expected;
}
