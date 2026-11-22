import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { GET as authGet, POST as authPost, emailConfirmationRedirect } from "../app/api/auth/route";
import { GET as characterGet, POST as characterPost } from "../app/api/account/character/route";
import { GET as adminGet, POST as adminPost } from "../app/api/admin/accounts/route";
import { POST as quickAdminPost } from "../app/api/admin/quick-access/route";

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

test("implicit email confirmation cannot bind a refresh token from another account", async () => {
  const prior = globalThis.fetch;
  const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const priorKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-fixture.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "user-one", email: "one@example.com" }), { status: 200 });
    }
    if (url.includes("/auth/v1/token?grant_type=refresh_token")) {
      return new Response(JSON.stringify({
        access_token: "other-access", refresh_token: "other-refresh", expires_in: 3600,
        user: { id: "user-two", email: "two@example.com" },
      }), { status: 200 });
    }
    throw new Error("Unexpected Auth request: " + url);
  };
  try {
    const response = await authPost(request("/api/auth", "POST", {
      action: "adopt", accessToken: "email-access", refreshToken: "email-refresh",
    }));
    expect(response.status).toBe(401);
    expect(response.cookies.get("audition_account_access")).toBeUndefined();
  } finally {
    globalThis.fetch = prior;
    if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
    if (priorKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = priorKey;
  }
});

test("authenticated account rejects malicious M3 outfits without creating a row", async () => {
  const prior = globalThis.fetch;
  const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const priorKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-fixture.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  globalThis.fetch = async input => {
    expect(String(input)).toContain("/auth/v1/user");
    return new Response(JSON.stringify({
      id: "11111111-1111-4111-8111-111111111111", email: "owner@example.com",
    }), { status: 200 });
  };
  try {
    const source = request("/api/account/character", "POST", {
      profile: {
        version: 1, gender: "female", characterAssetId: "m3-drophunter", name: "Dancer",
        hairStyle: "short", hairColor: "original", skinTone: "originalskin",
        face: "default", m3Outfit: { top: "not-catalog", bottom: "not-catalog" },
      },
    });
    source.cookies.set("audition_account_access", "mocked-access");
    const result = await characterPost(source);
    expect(result.status).toBe(400);
    expect((await result.json()).error).toContain("không hợp lệ");
  } finally {
    globalThis.fetch = prior;
    if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
    if (priorKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = priorKey;
  }
});

test("email confirmation URL uses a stable branch hostname, not a deployment hash", () => {
  const original = process.env.VERCEL_BRANCH_URL;
  const originalOverride = process.env.AUTH_REDIRECT_ORIGIN;
  delete process.env.AUTH_REDIRECT_ORIGIN;
  process.env.VERCEL_BRANCH_URL = "audition-mobile-mvp-git-work-ac-3c9ef9-toan-freelances-projects.vercel.app";
  try {
    expect(emailConfirmationRedirect(request("/api/auth", "POST"))).toBe(
      "https://audition-mobile-mvp-git-work-ac-3c9ef9-toan-freelances-projects.vercel.app/auth"
    );
  } finally {
    if (original === undefined) delete process.env.VERCEL_BRANCH_URL;
    else process.env.VERCEL_BRANCH_URL = original;
    if (originalOverride === undefined) delete process.env.AUTH_REDIRECT_ORIGIN;
    else process.env.AUTH_REDIRECT_ORIGIN = originalOverride;
  }
});

test("email confirmation URL explicitly rejects insecure external redirects", () => {
  const original = process.env.AUTH_REDIRECT_ORIGIN;
  process.env.AUTH_REDIRECT_ORIGIN = "http://untrusted.example";
  try {
    expect(() => emailConfirmationRedirect(request("/api/auth", "POST"))).toThrow("Invalid Auth redirect origin");
  } finally {
    if (original === undefined) delete process.env.AUTH_REDIRECT_ORIGIN;
    else process.env.AUTH_REDIRECT_ORIGIN = original;
  }
});

test("admin endpoints fail closed without a verified session", async () => {
  const list = await adminGet(request("/api/admin/accounts"));
  expect(list.status).toBe(401);
  const body = await list.json();
  expect(body.error).toContain("Admin code required");
  expect(JSON.stringify(body)).not.toContain("users");
  const deletion = await adminPost(request("/api/admin/accounts", "POST", {
    action: "delete", userId: "123e4567-e89b-42d3-a456-426614174000",
    confirmEmail: "test@example.com",
  }));
  expect(deletion.status).toBe(401);
});

test("admin account deletion rejects cross-origin requests before session lookup", async () => {
  const response = await adminPost(request("/api/admin/accounts", "POST", {
    action: "delete", userId: "123e4567-e89b-42d3-a456-426614174000",
    confirmEmail: "test@example.com",
  }, "https://malicious.example"));
  expect(response.status).toBe(403);
});

test("admin deletion rejects malformed IDs and missing email before privileged Edge call", async () => {
  const response = await adminPost(request("/api/admin/accounts", "POST", {
    action: "delete", userId: "not-a-user", confirmEmail: "",
  }));
  expect(response.status).toBe(400);
});

test("quick Admin rejects invalid code and foreign origin", async () => {
  const invalid = await quickAdminPost(request("/api/admin/quick-access", "POST", {
    action: "unlock", code: "short",
  }));
  expect(invalid.status).toBe(400);
  const foreign = await quickAdminPost(request("/api/admin/quick-access", "POST", {
    action: "unlock", code: "A".repeat(32),
  }, "https://attacker.invalid"));
  expect(foreign.status).toBe(403);
});

test("quick Admin stores validated code in HttpOnly, Strict cookie", async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://admin-fixture.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, string>;
    expect(body.action).toBe("verify");
    expect(body.quickCode).toBe("A".repeat(32));
    return new Response(JSON.stringify({ ok: true, quickAdmin: true }), { status: 200 });
  };
  try {
    const response = await quickAdminPost(request("/api/admin/quick-access", "POST", {
      action: "unlock", code: "A".repeat(32),
    }));
    expect(response.status).toBe(200);
    const cookie = response.cookies.get("audition_quick_admin_v1");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("strict");
    expect(cookie?.path).toBe("/api/admin");
    expect(JSON.stringify(await response.json())).not.toContain("A".repeat(32));
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});

test("resend confirmation uses stable /auth redirect and never requires deleting the account", async () => {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const previousBranch = process.env.VERCEL_BRANCH_URL;
  const previousOrigin = process.env.AUTH_REDIRECT_ORIGIN;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-fixture.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  process.env.VERCEL_BRANCH_URL = "audition-mobile-mvp-git-work-ac-3c9ef9-toan-freelances-projects.vercel.app";
  delete process.env.AUTH_REDIRECT_ORIGIN;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    expect(url.pathname).toBe("/auth/v1/resend");
    expect(url.searchParams.get("redirect_to")).toBe(
      "https://audition-mobile-mvp-git-work-ac-3c9ef9-toan-freelances-projects.vercel.app/auth"
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      type: "signup", email: "test@example.com",
    });
    return new Response(JSON.stringify({}), { status: 200 });
  };
  try {
    const response = await authPost(request("/api/auth", "POST", {
      action: "resend-confirmation", email: "test@example.com",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, pendingConfirmation: true });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
    if (previousBranch === undefined) delete process.env.VERCEL_BRANCH_URL;
    else process.env.VERCEL_BRANCH_URL = previousBranch;
    if (previousOrigin === undefined) delete process.env.AUTH_REDIRECT_ORIGIN;
    else process.env.AUTH_REDIRECT_ORIGIN = previousOrigin;
  }
});

test("resend confirmation rejects invalid email without contacting Supabase", async () => {
  const response = await authPost(request("/api/auth", "POST", {
    action: "resend-confirmation", email: "invalid-email",
  }));
  expect(response.status).toBe(400);
});

test("rate-limited signup explains project email quota without inviting repeated retries", async () => {
  const fetchBefore = globalThis.fetch;
  const urlBefore = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyBefore = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-fixture.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  globalThis.fetch = async input => {
    expect(String(input)).toContain("/auth/v1/signup");
    return new Response(JSON.stringify({ code: "over_email_send_rate_limit",
      message: "email rate limit exceeded" }), { status: 429 });
  };
  try {
    const reply = await authPost(request("/api/auth", "POST", {
      action: "register", email: "test@example.com", password: "samplePassword123",
    }));
    expect(reply.status).toBe(429);
    const payload = await reply.json();
    expect(payload.code).toBe("email_rate_limited");
    expect(payload.error).toContain("Custom SMTP");
    expect(payload.error).toContain("Xóa tài khoản");
  } finally {
    globalThis.fetch = fetchBefore;
    if (urlBefore === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = urlBefore;
    if (keyBefore === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = keyBefore;
  }
});

test("reset-character requires valid target email and Admin authentication", async () => {
  const anonymous = await adminPost(request("/api/admin/accounts", "POST", {
    action: "reset-character", userId: "123e4567-e89b-42d3-a456-426614174000",
    confirmEmail: "test@example.com",
  }));
  expect(anonymous.status).toBe(401);
  const bad = await adminPost(request("/api/admin/accounts", "POST", {
    action: "reset-character", userId: "invalid", confirmEmail: "",
  }));
  expect(bad.status).toBe(400);
  const foreign = await adminPost(request("/api/admin/accounts", "POST", {
    action: "reset-character", userId: "123e4567-e89b-42d3-a456-426614174000",
    confirmEmail: "test@example.com",
  }, "https://other.example"));
  expect(foreign.status).toBe(403);
});

test("QA account creation requires Admin access and does not accept user-chosen credentials", async () => {
  const unauthorized = await adminPost(request("/api/admin/accounts", "POST", {
    action: "create-test-account", email: "victim@real.com", password: "injected",
  }));
  expect(unauthorized.status).toBe(401);
});

test("QA account POST forwards only server-generated action when Admin session exists", async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-fixture.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  globalThis.fetch = async (url, options) => {
    expect(String(url)).toContain("/functions/v1/auth-admin-v1");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      action: "create-test-account", quickCode: "A".repeat(32),
    });
    const body = JSON.parse(String(options?.body)) as Record<string, unknown>;
    expect(body.email).toBeUndefined();
    expect(body.password).toBeUndefined();
    return new Response(JSON.stringify({ ok: true, testAccount: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "audition-qa-123456789012345678901234@example.com",
      password: "generated-password",
    }}), { status: 201 });
  };
  try {
    const req = request("/api/admin/accounts", "POST", {
      action: "create-test-account", email: "victim@real.com", password: "unsafe",
    });
    req.cookies.set("audition_quick_admin_v1", "A".repeat(32));
    const response = await adminPost(req);
    expect(response.status).toBe(201);
    expect((await response.json()).testAccount.email).toContain("audition-qa-");
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});
