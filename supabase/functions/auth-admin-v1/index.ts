// @ts-nocheck -- Supabase Deno Edge runtime; Next.js typecheck has no Deno globals.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Privileged account actions are isolated in a Supabase Edge Function.
// No service-role key ever enters Vercel, browser bundles or JWT metadata.
// Every request is authorized with an expiring high-entropy Admin test code OR
// a verified login with a private server-side email allowlist.

type AuthUser = { id: string; email?: string | null; email_confirmed_at?: string | null };
type AuthListUser = { id: string; email?: string | null; email_confirmed_at?: string | null;
  created_at?: string | null; last_sign_in_at?: string | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function environment() {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !publicKey) throw Error("Supabase Edge configuration missing");
  return { url, serviceKey, publicKey };
}
async function callProvider(url: string, key: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      apikey: key,
      authorization: "Bearer " + key,
      "content-type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}
async function isAdminEmail(env: ReturnType<typeof environment>, email: string) {
  const query = "/rest/v1/account_admin_emails?select=email&email=eq."
    + encodeURIComponent(email) + "&limit=1";
  const r = await callProvider(env.url + query, env.serviceKey);
  if (!r.ok) throw Error("Admin allowlist unavailable");
  const rows = await r.json() as Array<{ email: string }>;
  return rows.length === 1 && rows[0].email === email;
}

// This function must use verify_jwt=false in deployment: it verifies every
// request itself (high-entropy short-lived test code OR confirmed admin JWT).
// Never trust a publishable Supabase API key as proof of administration.
async function validateQuickCode(env: ReturnType<typeof environment>, code: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(code)) return false;
  const result = await callProvider(
    env.url + "/rest/v1/admin_quick_access?select=code_sha256,expires_at,enabled"
      + "&access_id=eq.auth-v1-test&limit=1", env.serviceKey);
  if (!result.ok) throw Error("Quick admin configuration unavailable");
  const rows = await result.json() as Array<{
    code_sha256: string; expires_at: string; enabled: boolean;
  }>;
  const row = rows[0];
  if (!row?.enabled || !Number.isFinite(Date.parse(row.expires_at))
    || Date.parse(row.expires_at) <= Date.now()) return false;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  const hash = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
  return hash === row.code_sha256;
}

Deno.serve(async req => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  try {
    const env = environment();
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return response({ error: "Invalid JSON" }, 400); }
    const code = typeof body.quickCode === "string" ? body.quickCode : "";
    const quickAdmin = code ? await validateQuickCode(env, code) : false;
    let caller: AuthUser = { id: "", email: null };
    if (!quickAdmin) {
      const bearer = req.headers.get("authorization") ?? "";
      const jwt = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
      if (!jwt || jwt.length > 8192) return response({ error: "Admin access code required" }, 401);
      const verify = await fetch(env.url + "/auth/v1/user", {
        method: "GET", cache: "no-store",
        headers: { apikey: env.publicKey, authorization: "Bearer " + jwt },
      });
      if (!verify.ok) return response({ error: "Authentication required" }, 401);
      caller = await verify.json() as AuthUser;
      const callerEmail = typeof caller.email === "string" ? caller.email.trim().toLowerCase() : "";
      if (!UUID.test(caller.id) || !callerEmail || !caller.email_confirmed_at
        || !(await isAdminEmail(env, callerEmail))) {
        return response({ error: "Admin permission required" }, 403);
      }
    }
    if (body.action === "verify") return response({ ok: true, quickAdmin });
    if (body.action === "list") {
      const page = Number.isInteger(body.page) && Number(body.page) >= 1 && Number(body.page) <= 1000
        ? Number(body.page) : 1;
      const result = await callProvider(env.url + "/auth/v1/admin/users?page=" + page + "&per_page=40", env.serviceKey);
      if (!result.ok) return response({ error: "Unable to list accounts" }, 502);
      const data = await result.json() as { users?: AuthListUser[]; total?: number; next_page?: number | null };
      const users = Array.isArray(data.users) ? data.users : [];
      return response({
        ok: true, isAdmin: true, currentUserId: caller.id, page,
        nextPage: data.next_page && data.next_page > page ? data.next_page : (users.length === 40 ? page + 1 : null),
        users: users.map(u=>({
          id: u.id, email: u.email ?? null, confirmed: !!u.email_confirmed_at,
          createdAt: u.created_at ?? null, lastSignInAt: u.last_sign_in_at ?? null,
        })),
      });
    }
    if (body.action !== "delete" && body.action !== "reset-character") {
      return response({ error: "Unsupported action" }, 400);
    }
    const userId = typeof body.userId === "string" ? body.userId : "";
    const confirmEmail = typeof body.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
    if (!UUID.test(userId) || !confirmEmail || confirmEmail.length > 254) {
      return response({ error: "Invalid user or confirmation" }, 400);
    }
    const targetRes = await callProvider(env.url + "/auth/v1/admin/users/" + userId, env.serviceKey);
    if (targetRes.status === 404) return response({ error: "Account does not exist" }, 404);
    if (!targetRes.ok) return response({ error: "Unable to verify target account" }, 502);
    const payload = await targetRes.json() as AuthListUser & { user?: AuthListUser };
    const target = payload.user ?? payload;
    const email = typeof target.email === "string" ? target.email.trim().toLowerCase() : "";
    if (target.id !== userId || !email || email !== confirmEmail) {
      return response({ error: "Email confirmation does not match" }, 409);
    }
    // Do not permit one admin to delete a DIFFERENT admin.
    if (!quickAdmin && userId !== caller.id && await isAdminEmail(env, email)) {
      return response({ error: "Cannot delete another administrator" }, 403);
    }
    if (body.action === "reset-character") {
      // Test-only reset. Keep the confirmed Auth account and credentials, and
      // remove just its one character. Do not touch RoomState or other users.
      const result = await callProvider(env.url + "/rest/v1/player_characters?user_id=eq."
        + encodeURIComponent(userId), env.serviceKey, { method: "DELETE" });
      if (!result.ok) return response({ error: "Unable to reset character" }, 502);
      return response({ ok: true, resetUserId: userId });
    }
    const deleted = await callProvider(env.url + "/auth/v1/admin/users/" + userId, env.serviceKey,
      { method: "DELETE" });
    if (!deleted.ok) {
      return response({ error: "Unable to delete account. Check linked Storage ownership." }, 502);
    }
    // CASCADE deletes player_characters; authenticated clients cannot delete
    // arbitrary auth.users. A deleted account can re-register its verified email.
    return response({ ok: true, deletedUserId: userId, deletedSelf: userId === caller.id });
  } catch {
    return response({ error: "Admin service unavailable" }, 503);
  }
});
