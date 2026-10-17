"use client";

import { useEffect, useState } from "react";
import { C3_START_TRACE_KEY, type C3StartCheckpoint } from "../../../components/multiplayer/c3-start-trace";

export default function C3StartTracePage() {
  const [entries, setEntries] = useState<C3StartCheckpoint[]>([]);
  const [status, setStatus] = useState("");
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(C3_START_TRACE_KEY) || "[]");
      setEntries(Array.isArray(value) ? value : []);
    } catch { setEntries([]); }
  };
  useEffect(() => { read(); }, []);
  return (
    <main style={{ minHeight: "100dvh", background: "#080b20", color: "#fff", padding: 20, fontFamily: "system-ui" }}>
      <h1>C3 START — SAFARI DIAGNOSTICS</h1>
      <p style={{ color: "#bfd2f2" }}>Các mốc xử lý START được lưu trên thiết bị này. Không lưu thông tin phòng, tài khoản hoặc nội dung trận đấu.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={read} type="button">Làm mới</button>
        <button type="button" onClick={() => {
          void navigator.clipboard.writeText(entries.map(x => `${x.at} · ${x.step}`).join("\n")).then(
            () => setStatus("Đã sao chép"),
            () => setStatus("Không thể sao chép; chụp ảnh màn hình."),
          );
        }}>Sao chép checkpoint</button>
        <a href="/rooms" style={{ color: "#84e8ff" }}>Về danh sách phòng</a>
      </div>
      <p role="status">{status}</p>
      <pre data-testid="c3-start-trace" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7 }}>
        {entries.length ? entries.map(x => `${x.at} · ${x.step}`).join("\n") : "Chưa có START checkpoint trên trình duyệt này."}
      </pre>
    </main>
  );
}
