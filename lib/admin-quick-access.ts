import { NextRequest, NextResponse } from "next/server";
import { propagateSession, resolveAccountSession } from "./account-auth";

export const QUICK_ADMIN_COOKIE = "audition_quick_admin_v1";
const COOKIE_PATH = "/api/admin";
const MAX_AGE_SECONDS = 12 * 60 * 60;

export type AdminResponse = Record<string, unknown>;

export function adminJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: {
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  } });
}

export function quickAdminCode(request: NextRequest) {
  const code = request.cookies.get(QUICK_ADMIN_COOKIE)?.value;
  return code && /^[A-Za-z0-9_-]{32}$/.test(code) ? code : null;
}

export function setQuickAdminCookie(response: NextResponse, code: string) {
  response.cookies.set(QUICK_ADMIN_COOKIE, code, {
    path: COOKIE_PATH,
    httpOnly: true, sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
  });
  return response;
}

export function clearQuickAdminCookie(response: NextResponse) {
  response.cookies.set(QUICK_ADMIN_COOKIE, "", {
    path: COOKIE_PATH,
    httpOnly: true, sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}

// Edge Function validates a fresh server-side hash/expiry on EVERY request;
// the cookie is not trusted merely because it exists.
export async function callAdminEdge(request: NextRequest, payload: AdminResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishable) return adminJson({ error: "Admin service not configured" }, 503);
  const code = quickAdminCode(request);
  let session = null;
  if (!code) {
    session = await resolveAccountSession(request);
    if (!session) return adminJson({ error: "Temporary Admin code required" }, 401);
  }
  const body = code ? { ...payload, quickCode: code } : payload;
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      apikey: publishable,
    };
    if (session) headers.authorization = "Bearer " + session.accessToken;
    const response = await fetch(
      supabaseUrl.replace(/\/$/, "") + "/functions/v1/auth-admin-v1",
      { method: "POST", headers, cache: "no-store", body: JSON.stringify(body) },
    );
    const data = await response.json() as AdminResponse;
    const result = propagateSession(adminJson(data, response.status), session);
    if (code && (response.status === 401 || response.status === 403)) {
      return clearQuickAdminCookie(result);
    }
    return result;
  } catch {
    return adminJson({ error: "Admin service temporarily unavailable" }, 503);
  }
}
