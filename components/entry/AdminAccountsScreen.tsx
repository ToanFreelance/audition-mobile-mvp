"use client";

import { useEffect, useState } from "react";
import styles from "./AccountAuthScreen.module.css";
import admin from "./AdminAccountsScreen.module.css";

type Account = {
  id: string; email: string | null; confirmed: boolean;
  createdAt: string | null; lastSignInAt: string | null;
};
type Result = {
  ok?: boolean; users?: Account[]; page?: number; nextPage?: number | null;
  currentUserId?: string; deletedSelf?: boolean; error?: string;
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
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessCode, setAccessCode] = useState("");

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
    setSelected(null); setUsers([]); setDenied(true);
    setError("Đã khóa Admin trên thiết bị này.");
  };

  const remove = async () => {
    if (!selected?.email || confirmEmail.trim().toLowerCase() !== selected.email.toLowerCase()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await fetch("/api/admin/accounts", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", userId: selected.id, confirmEmail }),
      });
      const data = await r.json() as Result;
      if (!r.ok || !data.ok) throw Error(data.error ?? "Không xóa được tài khoản.");
      if (data.deletedSelf) {
        // Session cookies must be cleared before this email registers again.
        await fetch("/api/auth", { method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
        window.location.replace("/auth");
        return;
      }
      setSelected(null); setConfirmEmail("");
      setNotice("Đã xóa tài khoản. Có thể đăng ký lại bằng email này.");
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
            <div className={admin.summary}>
              <strong>Danh sách tài khoản</strong>
              <div className={admin.actions}><button type="button" disabled={busy} onClick={() => void load(page)}>Làm mới</button><button type="button" onClick={() => void lock()}>Khóa Admin</button></div>
            </div>
            <div className={admin.list}>
              {users.map(user => (
                <article className={admin.item} key={user.id}>
                  <div className={admin.userInfo}>
                    <strong>{user.email ?? "Chưa có email"} {user.id === selfId && <small>(Bạn)</small>}</strong>
                    <span>{user.confirmed ? "Đã xác minh" : "Chưa xác minh"} · Tạo: {dateLabel(user.createdAt)}</span>
                    <span>Đăng nhập gần nhất: {dateLabel(user.lastSignInAt)}</span>
                  </div>
                  <button type="button" className={admin.delete} disabled={!user.email || busy}
                    onClick={() => { setSelected(user); setConfirmEmail(""); setError(""); }}
                    aria-label={"Xóa tài khoản " + (user.email ?? user.id)}>Xóa</button>
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
          <section className={admin.confirm} data-testid="admin-delete-confirmation">
            <strong>Xóa vĩnh viễn tài khoản</strong>
            <p>Nhân vật và hồ sơ liên quan sẽ bị xóa. {selected.id === selfId
              ? "Bạn đang xóa tài khoản admin của chính mình. Sau đó phải đăng ký/xác minh email và đăng nhập lại."
              : "Thao tác này không thể hoàn tác."}</p>
            <label>Nhập chính xác email <strong>{selected.email}</strong> để xác nhận
              <input type="email" autoComplete="off" value={confirmEmail}
                onChange={event => setConfirmEmail(event.target.value)} placeholder="Nhập email xác nhận" />
            </label>
            <div className={admin.confirmButtons}>
              <button type="button" onClick={() => { setSelected(null); setConfirmEmail(""); }}>Hủy</button>
              <button type="button" data-testid="admin-confirm-delete" className={admin.delete}
                disabled={busy || confirmEmail.trim().toLowerCase() !== selected.email?.toLowerCase()}
                onClick={() => void remove()}>{busy ? "Đang xóa…" : "XÓA VĨNH VIỄN"}</button>
            </div>
          </section>
        )}
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.links}><a href="/auth">Tài khoản</a><a href="/rooms">Room Browser</a></div>
      </section>
    </main>
  );
}
