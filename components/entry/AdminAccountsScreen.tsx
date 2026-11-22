"use client";

import { useEffect, useState } from "react";
import styles from "./AccountAuthScreen.module.css";
import admin from "./AdminAccountsScreen.module.css";

type Account = {
  id: string; email: string | null; confirmed: boolean; isTestAccount?: boolean;
  createdAt: string | null; lastSignInAt: string | null;
};
type Result = {
  ok?: boolean; users?: Account[]; page?: number; nextPage?: number | null;
  currentUserId?: string; deletedSelf?: boolean; error?: string;
  testAccount?: { id: string; email: string; password: string };
};

function dateLabel(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("vi-VN");
}
export default function AdminAccountsScreen() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [users, setUsers] = useState<Account[]>([]);
  const [selfId, setSelfId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [denied, setDenied] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);
  const [selectedAction, setSelectedAction] = useState<"delete" | "reset-character" | "reset-qa-password">("delete");
  const [busy, setBusy] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [newTestAccount, setNewTestAccount] = useState<{ email: string; password: string } | null>(null);

  const load = async (next = 1) => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/admin/accounts?page=" + next, { credentials: "same-origin", cache: "no-store" });
      const data = await r.json() as Result;
      if (r.status === 401 || r.status === 403) {
        setDenied(true);
        setError("Hãy dùng mã Admin tạm thời để mở danh sách tài khoản.");
        return;
      }
      if (!r.ok || !data.ok || !Array.isArray(data.users)) throw Error(data.error ?? "Không tải được danh sách tài khoản.");
      setPage(data.page ?? next); setNextPage(data.nextPage ?? null);
      setUsers(data.users); setSelfId(data.currentUserId ?? ""); setDenied(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(1); }, []);

  const unlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/quick-access", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "unlock", code: accessCode }),
      });
      const result = await response.json() as Result;
      if (!response.ok || !result.ok) throw Error(result.error ?? "Mã Admin không đúng.");
      setAccessCode("");
      await load(1);
    } catch (error) { setError(error instanceof Error ? error.message : "Không mở được Admin."); }
    finally { setBusy(false); }
  };
  const lock = async () => {
    await fetch("/api/admin/quick-access", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    });
    setSelected(null); setUsers([]); setNewTestAccount(null); setDenied(true);
    setError("Đã khóa Admin trên thiết bị này.");
  };

  const createTestAccount = async () => {
    setBusy(true); setError(""); setNotice(""); setNewTestAccount(null);
    try {
      const r = await fetch("/api/admin/accounts", {
        method: "POST", cache: "no-store", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create-test-account" }),
      });
      const data = await r.json() as Result;
      if (!r.ok || !data.ok || !data.testAccount) {
        throw Error(data.error ?? "Không tạo được tài khoản QA.");
      }
      setNewTestAccount({ email: data.testAccount.email, password: data.testAccount.password });
      await load(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo tài khoản QA.");
    } finally { setBusy(false); }
  };

  const signInTestAccount = async () => {
    if (!newTestAccount || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      // The newly generated credentials only live in this component state.
      // Reuse the normal sign-in API: no privileged impersonation/session bypass.
      const response = await fetch("/api/auth", {
        method: "POST", cache: "no-store", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "login",
          email: newTestAccount.email, password: newTestAccount.password }),
      });
      const result = await response.json() as { ok?: boolean; pendingConfirmation?: boolean; error?: string };
      if (!response.ok || !result.ok || result.pendingConfirmation) {
        throw Error(result.error ?? "Không thể đăng nhập tài khoản QA.");
      }
      setNewTestAccount(null);
      window.location.assign("/character/create");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đăng nhập tài khoản QA.");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!selected?.email || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await fetch("/api/admin/accounts", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        // Retain the server-side exact target email check, but no typing is
        // required after the owner approves the explicit modal.
        body: JSON.stringify({ action: selectedAction, userId: selected.id, confirmEmail: selected.email }),
      });
      const data = await r.json() as Result;
      if (!r.ok || !data.ok) throw Error(data.error ?? "Không xóa được tài khoản.");
      if (selectedAction === "reset-qa-password") {
        if (!data.testAccount) throw Error("Không nhận được mật khẩu QA mới.");
        setNewTestAccount({ email: data.testAccount.email, password: data.testAccount.password });
      }
      if (selectedAction === "delete" && data.deletedSelf) {
        // Session cookies must be cleared before this email registers again.
        await fetch("/api/auth", { method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
        window.location.replace("/auth");
        return;
      }
      setSelected(null);
      setNotice(selectedAction === "reset-character"
        ? "Đã reset nhân vật. Tài khoản vẫn được xác minh; đăng nhập và tạo nhân vật M3 mới."
        : selectedAction === "reset-qa-password"
          ? "Đã cấp mật khẩu QA mới. Dùng nút Đăng nhập ngay hoặc sao chép mật khẩu; mật khẩu cũ không còn sử dụng."
          : "Đã xóa tài khoản. Việc đăng ký lại vẫn phụ thuộc hạn mức email xác minh của Supabase.");
      await load(page);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không xóa được."); }
    finally { setBusy(false); }
  };

  return (
    <main className={styles.page} data-testid="admin-page">
      <section className={[styles.card, admin.card].join(" ")}>
        <span className={styles.brand}>AUDITION · ACCOUNT</span>
        <h1>QUẢN TRỊ TEST</h1>
        <p className={styles.muted}>Không cần đăng nhập email. Nhập mã Admin tạm thời để quản lý tài khoản thử nghiệm.</p>
        <nav className={styles.tabs} aria-label="Tùy chọn tài khoản">
          <a href="/auth">ĐĂNG NHẬP</a>
          <a href="/auth?mode=register">ĐĂNG KÝ</a>
          <a className={styles.on} href="/admin" aria-current="page">ADMIN</a>
        </nav>
        {loading ? <p>Đang kiểm tra quyền truy cập…</p> : denied ? (
          <form className={admin.unlock} data-testid="admin-quick-unlock" onSubmit={event => void unlock(event)}>
            <label>Mã Admin tạm thời
              <input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false}
                maxLength={32} value={accessCode} placeholder="Dán mã Admin"
                onChange={event => setAccessCode(event.target.value.trim())}/>
            </label>
            <button type="submit" disabled={busy || accessCode.length !== 32}>
              {busy ? "ĐANG XÁC MINH…" : "MỞ DANH SÁCH"}
            </button>
          </form>
        ) : (
          <>
            <div className={admin.createSection}>
              <div>
                <strong>Test ngay, không cần email xác minh</strong>
                <p>Hệ thống sinh một tài khoản QA giả và mật khẩu riêng. Không dùng email cá nhân và không gửi email.</p>
              </div>
              <button type="button" className={admin.createButton} data-testid="admin-create-test-user"
                disabled={busy} onClick={() => void createTestAccount()}>
                {busy ? "ĐANG TẠO…" : "+ TẠO TÀI KHOẢN QA"}
              </button>
            </div>
            {newTestAccount && (
              <section className={admin.credentials} data-testid="admin-test-credentials">
                <strong>Thông tin đăng nhập QA — lưu lại ngay</strong>
                <p>Mật khẩu chỉ hiển thị trong phiên này và không thể xem lại.</p>
                <label>Email
                  <input readOnly value={newTestAccount.email} aria-label="Email tài khoản QA"/>
                </label>
                <label>Mật khẩu
                  <input readOnly value={newTestAccount.password} aria-label="Mật khẩu tài khoản QA"/>
                </label>
                <button type="button" className={admin.primaryTestLogin} data-testid="admin-test-login"
                  disabled={busy} onClick={() => void signInTestAccount()}>
                  {busy ? "ĐANG ĐĂNG NHẬP…" : "ĐĂNG NHẬP NGAY → TẠO NHÂN VẬT"}
                </button>
                <div className={admin.copyActions}>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(newTestAccount.email)}>
                    Copy email
                  </button>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(newTestAccount.password)}>
                    Copy mật khẩu
                  </button>
                </div>
                <button type="button" onClick={() => void navigator.clipboard.writeText(
                  "Email: " + newTestAccount.email + "\nPassword: " + newTestAccount.password
                )}>Sao chép cả hai (dùng trên thiết bị khác)</button>
              </section>
            )}
            <div className={admin.summary}>
              <strong>Danh sách tài khoản</strong>
              <div className={admin.actions}><button type="button" disabled={busy} onClick={() => void load(page)}>Làm mới</button><button type="button" onClick={() => void lock()}>Khóa Admin</button></div>
            </div>
            <div className={admin.list}>
              {users.map(user => (
                <article className={admin.item} key={user.id}>
                  <div className={admin.userInfo}>
                    <strong>{user.email ?? "Chưa có email"} {user.isTestAccount && <small>(QA)</small>} {user.id === selfId && <small>(Bạn)</small>}</strong>
                    <span>{user.confirmed ? "Đã xác minh" : "Chưa xác minh"} · Tạo: {dateLabel(user.createdAt)}</span>
                    <span>Đăng nhập gần nhất: {dateLabel(user.lastSignInAt)}</span>
                  </div>
                  <div className={admin.accountActions}>
                    {user.isTestAccount && (
                      <button type="button" className={admin.reset} disabled={busy}
                        data-testid={"qa-password-reset-" + user.id}
                        onClick={() => { setSelected(user); setSelectedAction("reset-qa-password"); setError(""); }}
                        aria-label={"Cấp lại mật khẩu QA " + (user.email ?? user.id)}>
                        Mật khẩu QA
                      </button>
                    )}
                    <button type="button" className={admin.reset} disabled={!user.email || busy}
                      onClick={() => { setSelected(user); setSelectedAction("reset-character"); setError(""); }}
                      aria-label={"Reset nhân vật " + (user.email ?? user.id)}>Reset NV</button>
                    <button type="button" className={admin.delete} disabled={!user.email || busy}
                      onClick={() => { setSelected(user); setSelectedAction("delete"); setError(""); }}
                      aria-label={"Xóa tài khoản " + (user.email ?? user.id)}>Xóa</button>
                  </div>
                </article>
              ))}
              {users.length === 0 && <p className={styles.muted}>Không có tài khoản trong trang này.</p>}
            </div>
            <div className={admin.pagination}>
              <button type="button" disabled={loading || busy || page <= 1} onClick={() => void load(page - 1)}>Trước</button>
              <span>Trang {page}</span>
              <button type="button" disabled={loading || busy || !nextPage} onClick={() => void load(nextPage!)}>Sau</button>
            </div>
          </>
        )}
        {selected && (
          <div className={admin.modalBackdrop} data-testid="admin-confirm-overlay">
            <section className={admin.confirm} role="alertdialog" aria-modal="true"
              aria-labelledby="admin-action-title" aria-describedby="admin-action-description"
              data-testid="admin-delete-confirmation">
              <strong id="admin-action-title">
                {selectedAction === "reset-character" ? "Reset nhân vật?" :
                  selectedAction === "reset-qa-password" ? "Cấp lại mật khẩu QA?" : "Xóa tài khoản?"}
              </strong>
              <p id="admin-action-description">
                <strong>{selected.email}</strong>
                {selectedAction === "reset-character"
                  ? " — Nhân vật hiện tại sẽ bị xóa. Tài khoản và email đã xác minh vẫn được giữ."
                  : selectedAction === "reset-qa-password"
                    ? " — Mật khẩu cũ sẽ hết hiệu lực. Mật khẩu mới được hiển thị một lần; nhân vật vẫn giữ nguyên."
                    : " — Tài khoản và nhân vật sẽ bị xóa vĩnh viễn. Không thể hoàn tác."}
                {selectedAction === "delete" && selected.id === selfId && " Đây là tài khoản đang đăng nhập."}
              </p>
              <div className={admin.confirmButtons}>
                <button type="button" data-testid="admin-cancel-action"
                  disabled={busy} onClick={() => setSelected(null)}>KHÔNG, HỦY</button>
                <button type="button" data-testid="admin-confirm-delete" className={admin.delete}
                  disabled={busy} onClick={() => void remove()}>
                  {busy ? "ĐANG XỬ LÝ…" :
                    selectedAction === "reset-character" ? "CÓ, RESET" :
                    selectedAction === "reset-qa-password" ? "CÓ, CẤP LẠI" : "CÓ, XÓA"
                </button>
              </div>
            </section>
          </div>
        )}
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.links}><a href="/auth">Tài khoản</a><a href="/rooms">Room Browser</a></div>
      </section>
    </main>
  );
}
