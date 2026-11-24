import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "audition_account_access";
const REFRESH_COOKIE = "audition_account_refresh";

export type AuthUser = { id: string; email: string | null };
type TokenSession = {
  access_token: string; refresh_token: string;
  expires_in?: number; user?: { id?: string; email?: string };
};
export type AccountSession = {
  user: AuthUser; accessToken: string; renewed: TokenSession | null;
};

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) throw new Error("Supabase Auth configuration missing");
  return { url: url.replace(/\/$/, ""), key };
}

export async function supabaseRequest(
  resource: string, init: RequestInit = {}, bearer?: string,
): Promise<Response> {
  const { url, key } = authConfig();
  return fetch(url + resource, {
    ...init, cache: "no-store",
    headers: {
      apikey: key, "content-type": "application/json",
      ...(bearer ? { authorization: "Bearer " + bearer } : {}),
      ...init.headers,
    },
  });
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch { return false; }
}

export async function providerError(response: Response, fallback: string) {
  let error = fallback;
  try {
    const body = await response.json() as Record<string, unknown>;
    const detail = body.msg ?? body.error_description ?? body.message ?? body.error;
    if (typeof detail === "string" && detail.length < 160) error = detail;
  } catch {}
  return error;
}

async function verifyUser(accessToken: string): Promise<AuthUser | null> {
  const response = await supabaseRequest("/auth/v1/user", { method: "GET" }, accessToken);
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("Supabase Auth temporarily unavailable");
  const body = await response.json() as { id?: unknown; email?: unknown };
  if (typeof body.id !== "string") return null;
  return { id: body.id, email: typeof body.email === "string" ? body.email : null };
}

export function hasAccountCredentials(request: NextRequest) {
  return Boolean(request.cookies.get(ACCESS_COOKIE)?.value || request.cookies.get(REFRESH_COOKIE)?.value);
}

export async function resolveAccountSession(request: NextRequest): Promise<AccountSession | null> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    const user = await verifyUser(accessToken);
    if (user) return { user, accessToken, renewed: null };
  }
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const refresh = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST", body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (refresh.status === 400 || refresh.status === 401 || refresh.status === 403) return null;
  if (!refresh.ok) throw new Error("Could not refresh account session");
  const tokens = await refresh.json() as TokenSession;
  if (!tokens.access_token || !tokens.refresh_token) return null;
  const user = await verifyUser(tokens.access_token);
  return user ? { user, accessToken: tokens.access_token, renewed: tokens } : null;
}

export function setAuthCookies(response: NextResponse, tokens: TokenSession) {
  const secure = process.env.NODE_ENV === "production";
  const options = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, {
    ...options, maxAge: Math.max(30, (tokens.expires_in ?? 3600) - 30),
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
    ...options, maxAge: 60 * 60 * 24 * 30,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}

export function propagateSession(response: NextResponse, session: AccountSession | null) {
  return session?.renewed ? setAuthCookies(response, session.renewed) : response;
}

export function clearAuthCookies(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) response.cookies.set(name, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 0,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
