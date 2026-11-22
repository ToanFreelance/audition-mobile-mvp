import { NextRequest, NextResponse } from "next/server";
import {
  clearAuthCookies, isSameOrigin, propagateSession,
  providerError, resolveAccountSession, setAuthCookies, supabaseRequest,
} from "../../../lib/account-auth";

export const dynamic = "force-dynamic";

/** Use a stable Git-branch URL for email confirmation, never a one-off
 * deployment URL. The destination must still be in Supabase's redirect allow list. */
export function emailConfirmationRedirect(request: NextRequest) {
  const configured = process.env.AUTH_REDIRECT_ORIGIN;
  const branchHostname = process.env.VERCEL_BRANCH_URL;
  const origin = configured || (branchHostname ? "https://" + branchHostname : request.nextUrl.origin);
  const url = new URL(origin);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production"
    && url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1"))) {
    throw new Error("Invalid Auth redirect origin");
  }
  return new URL("/auth", url).toString();
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveAccountSession(request);
    if (!session) return clearAuthCookies(json({ authenticated: false, user: null }));
    return propagateSession(json({ authenticated: true, user: session.user }), session);
  } catch {
    return json({ error: "Không xác minh được phiên đăng nhập." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Request origin invalid." }, 403);
  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch { return json({ error: "Dữ liệu không hợp lệ." }, 400); }
  const action = input.action;
  if (action === "logout") {
    const session = await resolveAccountSession(request).catch(() => null);
    if (session) await supabaseRequest("/auth/v1/logout?scope=local", {
      method: "POST", body: "{}",
    }, session.accessToken).catch(() => undefined);
    return clearAuthCookies(json({ ok: true }));
  }
  if (action === "adopt") {
    const access = input.accessToken, refresh = input.refreshToken;
    if (typeof access !== "string" || typeof refresh !== "string"
      || access.length > 4096 || refresh.length > 4096) return json({ error: "Phiên xác thực không hợp lệ." }, 400);
    const response = await supabaseRequest("/auth/v1/user", { method: "GET" }, access);
    if (!response.ok) return json({ error: "Liên kết xác nhận đã hết hạn." }, 401);
    const user = await response.json() as { id?: string; email?: string };
    if (!user.id) return json({ error: "Không xác minh được tài khoản." }, 401);
    // Implicit callback tokens are untrusted until the refresh token is also
    // verified and bound to the SAME account. Rotate on adoption to avoid a
    // swapped refresh token silently changing identity after expiry.
    const rotated = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!rotated.ok) return json({ error: "Phiên xác nhận đã hết hạn. Hãy đăng nhập lại." }, 401);
    const tokens = await rotated.json() as {
      access_token?: string; refresh_token?: string; expires_in?: number;
      user?: { id?: string; email?: string };
    };
    if (!tokens.access_token || !tokens.refresh_token || tokens.user?.id !== user.id) {
      return json({ error: "Phiên xác nhận không khớp tài khoản." }, 401);
    }
    return setAuthCookies(json({ ok: true, user: { id: user.id, email: user.email ?? null } }),
      { access_token: tokens.access_token, refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in });
  }
  if (action === "resend-confirmation") {
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      return json({ error: "Email không hợp lệ." }, 400);
    }
    try {
      const path = "/auth/v1/resend?redirect_to="
        + encodeURIComponent(emailConfirmationRedirect(request));
      const response = await supabaseRequest(path, {
        method: "POST", body: JSON.stringify({ type: "signup", email }),
      });
      if (response.status === 429) {
        return json({ error: "Supabase đã hết hạn mức gửi email xác minh của project. Không cần xóa tài khoản; hãy chờ quota phục hồi hoặc cấu hình Custom SMTP.", code: "email_rate_limited" }, 429);
      }
      // Do not leak whether a particular email exists in Supabase Auth.
      if (!response.ok) return json({ error: "Không thể gửi email xác minh lúc này." }, 502);
      return json({ ok: true, pendingConfirmation: true });
    } catch {
      return json({ error: "Không kết nối được dịch vụ xác minh." }, 503);
    }
  }
  if (action !== "register" && action !== "login") return json({ error: "Unsupported action." }, 400);
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = input.password;
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254
    || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return json({ error: "Email không hợp lệ hoặc mật khẩu phải dài 8–128 ký tự." }, 400);
  }
  try {
    const path = action === "register"
      ? "/auth/v1/signup?redirect_to=" + encodeURIComponent(emailConfirmationRedirect(request))
      : "/auth/v1/token?grant_type=password";
    const auth = await supabaseRequest(path, {
      method: "POST", body: JSON.stringify({ email, password }),
    });
    if (!auth.ok) {
      const message = await providerError(auth,
        action === "login" ? "Email hoặc mật khẩu không chính xác." : "Không đăng ký được tài khoản.");
      if (auth.status === 429) {
        return json({ error: action === "register"
          ? "Supabase đã hết hạn mức gửi email xác minh của project. Xóa tài khoản không đặt lại quota. Hãy chờ quota phục hồi hoặc cấu hình Custom SMTP."
          : "Supabase đang giới hạn số lần xác thực. Hãy thử lại sau.",
          code: action === "register" ? "email_rate_limited" : "auth_rate_limited" }, 429);
      }
      return json({ error: message }, 400);
    }
    const response = await auth.json() as {
      access_token?: string; refresh_token?: string; expires_in?: number;
      user?: { id?: string; email?: string }; id?: string;
    };
    if (response.access_token && response.refresh_token) {
      return setAuthCookies(json({ ok: true, pendingConfirmation: false,
        user: response.user ? { id: response.user.id, email: response.user.email } : null }),
      { access_token: response.access_token, refresh_token: response.refresh_token,
        expires_in: response.expires_in });
    }
    // When Confirm Email is enabled, Supabase returns a user but no session.
    return json({ ok: true, pendingConfirmation: true });
  } catch {
    return json({ error: "Không kết nối được dịch vụ đăng nhập." }, 503);
  }
}
