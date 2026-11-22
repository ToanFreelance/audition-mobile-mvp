"use client";

import { useCallback, useEffect, useState } from "react";
import { getCharacterCatalogEntry, type CharacterAssetId } from "../../../components/character/character-catalog";
import { parseM3LobbyAppearance } from "../../../components/character/m3-lobby-appearance";
import {
  m3CacheKey, m3SelectedAssetFiles, warmM3AppearanceAssets,
  inspectM3AppearanceCache, M3_ASSET_CACHE_REVISION,
} from "../../../components/character/m3-asset-cache";
import { removePersistentAssetCached } from "../../../lib/persistent-asset-cache";
import type { M3LobbyAppearance } from "../../../multiplayer/types";

type Selection = { assetId: CharacterAssetId; appearance: M3LobbyAppearance };
type Status = Awaited<ReturnType<typeof inspectM3AppearanceCache>>;

export default function M3CacheQaPage() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const check = useCallback(async (selected: Selection) => {
    setStatus(await inspectM3AppearanceCache(selected.assetId, selected.appearance));
  }, []);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/character", {
          credentials: "same-origin", cache: "no-store",
        });
        if (!response.ok) throw new Error("Hãy đăng nhập tài khoản QA trước.");
        const data = await response.json() as {
          profile?: { characterAssetId?: string } | null;
        };
        if (!data.profile?.characterAssetId) throw new Error("Tài khoản chưa lưu nhân vật M3.");
        const entry = getCharacterCatalogEntry(data.profile.characterAssetId);
        if (!entry?.m3RigFamily) throw new Error("Cần nhân vật M3 để test cache.");
        const appearance = parseM3LobbyAppearance(entry.id, data.profile);
        if (!appearance) throw new Error("Diện mạo M3 không hợp lệ.");
        if (disposed) return;
        const selected = { assetId: entry.id, appearance };
        setSelection(selected);
        await check(selected);
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : "Không kiểm tra được cache.");
      }
    })();
    return () => { disposed = true; };
  }, [check]);

  const run = async (action: "warm" | "clear" | "check") => {
    if (!selection || busy) return;
    setBusy(true); setError(""); setResult("");
    try {
      if (action === "warm") {
        await warmM3AppearanceAssets(selection.assetId, selection.appearance);
        setResult("Đã tải và lưu các VRM/texture của nhân vật vào Cache Storage.");
      } else if (action === "clear") {
        const files = m3SelectedAssetFiles(selection.assetId, selection.appearance);
        await Promise.all(files.map(item => removePersistentAssetCached(m3CacheKey(item.family, item.file))));
        setResult("Đã xóa CHỈ các asset M3 được chọn để test cold load. Không xóa tài khoản hay audio.");
      }
      await check(selection);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không hoàn thành kiểm tra cache.");
    } finally { setBusy(false); }
  };
  const canStore = typeof window !== "undefined" && "caches" in window;

  return (
    <main style={{ minHeight: "100dvh", padding: "24px 16px", color: "#f2eeff",
      background: "linear-gradient(#101329,#1c1a3d)", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ maxWidth: 620, margin: "auto", display: "grid", gap: 14 }}>
        <a href="/rooms" style={{ color: "#b9eaff" }}>← Room Browser</a>
        <h1 style={{ fontSize: 23, margin: 0 }}>M3 Asset Cache QA</h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          Dữ liệu profile luôn đọc mới từ Supabase. Chỉ các VRM/texture công khai
          của nhân vật được lưu trên thiết bị; cache không chứa email hay mật khẩu.
        </p>
        <p style={{ fontSize: 12, margin: 0 }}>Revision: {M3_ASSET_CACHE_REVISION}</p>
        {!canStore && <p role="alert">Safari không cung cấp Cache Storage trong phiên này.</p>}
        {status && <div data-testid="m3-cache-coverage" style={{ background: "#302b64",
          padding: 18, borderRadius: 12, fontSize: 23, fontWeight: 800 }}>
          {status.cached}/{status.total} files cached
        </div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {([
            ["check", "Kiểm tra lại"],
            ["warm", "Preload nhân vật"],
            ["clear", "Xóa cache M3 để test cold load"],
          ] as const).map(([action, text]) => (
            <button key={action} type="button" disabled={busy || !selection || !canStore}
              onClick={() => void run(action)} style={{
                minHeight: 43, background: "#5741a7", border: "1px solid #8b79e9",
                borderRadius: 9, color: "white", padding: "8px 12px", fontWeight: 700,
              }}>{busy ? "Đang xử lý…" : text}</button>
          ))}
        </div>
        {error && <p role="alert" style={{ color: "#ffb5bd" }}>{error}</p>}
        {result && <p role="status" style={{ color: "#a5e9c9" }}>{result}</p>}
        {status && <ul style={{ paddingLeft: 18, display: "grid", gap: 8 }}>
          {status.entries.map(entry => (
            <li key={entry.file} style={{ overflowWrap: "anywhere", fontSize: 12 }}>
              {entry.cached ? "✅" : "○"} {entry.file}
            </li>
          ))}
        </ul>}
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "#c5bfdc" }}>
          PASS sơ bộ: sau Preload phải là 6/6 (hoặc nhiều hơn nếu dùng skin tone khác),
          reload trang vẫn giữ số đó. Safari có thể tự xóa dữ liệu khi thiếu dung lượng.
          Để đo chính xác bytes mạng, dùng Web Inspector. Animation Mixamo dùng
          cache HTTP của JS bundle; Audio có cache bytes riêng.
        </p>
      </section>
    </main>
  );
}
