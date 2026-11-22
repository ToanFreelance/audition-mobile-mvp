import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { GET as authGet, POST as authPost } from "../app/api/auth/route";
import { GET as characterGet, POST as characterPost } from "../app/api/account/character/route";

function request(path: string, method = "GET", body?: Record<string, unknown>, origin = "https://game.test") {
  return new NextRequest("https://game.test" + path, {
    method,
    headers: { host: "game.test", origin, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("anonymous account endpoints cannot read or write a private character", async () => {
  const identity = await authGet(request("/api/auth"));
  expect(identity.status).toBe(200);
  expect(await identity.json()).toMatchObject({ authenticated: false, user: null });
  const profile = await characterGet(request("/api/account/character"));
  expect(profile.status).toBe(401);
  const changed = await characterPost(request("/api/account/character", "POST", { profile: {} }));
  expect(changed.status).toBe(401);
});

test("cross-site POST is denied before any Supabase request", async () => {
  const response = await authPost(request("/api/auth", "POST", {
    action: "login", email: "owner@example.com", password: "abcd1234",
  }, "https://attacker.invalid"));
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: "Request origin invalid." });
});

test("email/password login writes HttpOnly cookies but never exposes bearer tokens in JSON", async () => {
  const prior = globalThis.fetch;
  const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const priorKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-fixture.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  globalThis.fetch = async (input, init) => {
    expect(String(input)).toContain("/auth/v1/token?grant_type=password");
    expect(init?.method).toBe("POST");
    return new Response(JSON.stringify({
      access_token: "test-access-token", refresh_token: "test-refresh-token",
      expires_in: 3600, user: { id: "owner-id", email: "owner@example.com" },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await authPost(request("/api/auth", "POST", {
      action: "login", email: "owner@example.com", password: "abcd1234",
    }));
    expect(response.status).toBe(200);
    expect(response.cookies.get("audition_account_access")?.httpOnly).toBe(true);
    expect(response.cookies.get("audition_account_refresh")?.httpOnly).toBe(true);
    const payload = JSON.stringify(await response.json());
    expect(payload).not.toContain("test-access-token");
    expect(payload).not.toContain("test-refresh-token");
    expect(payload).toContain("owner@example.com");
  } finally {
    globalThis.fetch = prior;
    if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
    if (priorKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = priorKey;
  }
});

test("signup with email confirmation enabled does not fabricate a session", async () => {
  const prior = globalThis.fetch;
  const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const priorKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-fixture.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  globalThis.fetch = async input => {
    expect(String(input)).toContain("/auth/v1/signup?redirect_to=");
    return new Response(JSON.stringify({ user: { id: "pending" } }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await authPost(request("/api/auth", "POST", {
      action: "register", email: "new@example.com", password: "validPass123",
    }));
    expect(await response.json()).toMatchObject({ ok: true, pendingConfirmation: true });
    expect(response.cookies.get("audition_account_access")).toBeUndefined();
  } finally {
    globalThis.fetch = prior;
    if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
    if (priorKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = priorKey;
  }
});
