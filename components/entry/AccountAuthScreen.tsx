"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./AccountAuthScreen.module.css";

type Account = { id: string; email: string | null };
type AuthResult = { ok?: boolean; authenticated?: boolean; pendingConfirmation?: boolean; user?: Account | null; error?: string };

function nextRoute() {
  const value = new URLSearchParams(window.location.search).get("next") ?? "/character/create";
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value : "/character/create";
}

async function authRequest(payload: Record<string, unknown>) {
  const response = await fetch("/api/auth", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json() as AuthResult;
  if (!response.ok || !result.ok) throw new Error(result.error || "Không thể xác thực.");
  return result;
}

export default function AccountAuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        // Supabase email verification implicit links provide tokens in the fragment.
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const access = hash.get("access_token");
        const refresh = hash.get("refresh_token");
        if (access && refresh) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
          const result = await authRequest({ action: "adopt", accessToken: access,
            refreshToken: refresh, expiresIn: Number(hash.get("expires_in")) || 3600 });
          if (!cancelled) setAccount(result.user ?? null);
          if (!cancelled) setMessage("Email đã xác nhận. Tài khoản đã đăng nhập.");
        } else if (hash.get("error_description")) {
          if (!cancelled) setError("Liên kết xác nhận không hợp lệ hoặc hết hạn.");
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        const response = await fetch("/api/auth", { cache: "no-store" });
        const data = await response.json() as AuthResult;
        if (!cancelled && response.ok) setAccount(data.authenticated ? data.user ?? null : null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Không xác minh được phiên đăng nhập.");
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await authRequest({ action: mode, email, password });
      if (result.pendingConfirmation) {
        setMessage("Đăng ký đã được tiếp nhận. Nếu email xác nhận được bật, hãy mở email và xác nhận rồi đăng nhập.");
        setMode("login");
      } else {
        setAccount(result.user ?? null);
        window.location.assign(nextRoute());
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Có lỗi xác thực.");
    } finally { setBusy(false); }
  };

  const logout = async () => {
    setBusy(true); setError("");
    try {
      await authRequest({ action: "logout" });
      setAccount(null); setPassword("");
      setMessage("Đã đăng xuất trên thiết bị này.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đăng xuất được.");
    } finally { setBusy(false); }
  };

  return (
    <main className={styles.page} data-testid="account-auth-screen">
      <section className={styles.card}>
        <span className={styles.brand}>AUDITION · ACCOUNT</span>
        <h1>{account ? "TÀI KHOẢN" : "CHÀO MỪNG TRỞ LẠI"}</h1>
        <p className={styles.muted}>Đăng nhập bằng email và mật khẩu. Mỗi tài khoản chỉ sở hữu một nhân vật M3.</p>
        {initializing ? <p>Đang xác minh phiên đăng nhập…</p> : account ? (
          <>
            <p className={styles.account} data-testid="auth-user-email">{account.email || "Tài khoản đã đăng nhập"}</p>
            <button className={styles.submit} type="button" onClick={() => window.location.assign(nextRoute())}>VÀO GAME</button>
            <button className={styles.submit} type="button" onClick={logout} disabled={busy} data-testid="auth-logout">ĐĂNG XUẤT</button>
          </>
        ) : (
          <>
            <div className={styles.tabs}>
              <button className={mode === "login" ? styles.on : ""} onClick={() => { setMode("login"); setError(""); }} type="button">ĐĂNG NHẬP</button>
              <button className={mode === "register" ? styles.on : ""} onClick={() => { setMode("register"); setError(""); }} type="button">ĐĂNG KÝ</button>
            </div>
            <form onSubmit={submit}>
              <label className={styles.field}>EMAIL
                <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} data-testid="auth-email"/>
              </label>
              <label className={styles.field}>MẬT KHẨU
                <input required type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} data-testid="auth-password"/>
              </label>
              <button className={styles.submit} disabled={busy} type="submit" data-testid="auth-submit">
                {busy ? "ĐANG XỬ LÝ…" : mode === "login" ? "ĐĂNG NHẬP" : "TẠO TÀI KHOẢN"}
              </button>
            </form>
          </>
        )}
        {message && <p role="status" className={styles.notice}>{message}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.links}><a href="/character/create">Character Studio</a><a href="/rooms">Room Browser</a></div>
      </section>
    </main>
  );
}
