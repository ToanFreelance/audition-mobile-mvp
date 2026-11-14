"use client";

import { useEffect, useRef, useState } from "react";
import { M3WardrobeRuntime, WARDROBE, type WardrobeSlot, type WardrobeSnapshot } from "./runtime";
import "./m3-wardrobe.css";

const LABELS: Record<WardrobeSlot, { icon: string; name: string }> = {
  top: { icon: "✦", name: "Áo" },
  bottom: { icon: "◈", name: "Quần / váy" },
  shoes: { icon: "◉", name: "Giày" },
  hair: { icon: "✿", name: "Tóc" },
};

const DEFAULT_STATE: WardrobeSnapshot = {
  ready: false,
  message: "Đang tạo sân khấu...",
  error: null,
  bones: 0,
  mixerCount: 0,
  baseReloads: 0,
  equipped: { top: null, bottom: null, shoes: null, hair: null },
  cacheSize: 0,
  moving: true,
  maxBindDelta: 0,
};

export default function M3ModularWardrobePage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<M3WardrobeRuntime | null>(null);
  const [state, setState] = useState<WardrobeSnapshot>(DEFAULT_STATE);
  const [loadingSlot, setLoadingSlot] = useState<WardrobeSlot | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let live = true;
    let runtime: M3WardrobeRuntime | null = null;
    try {
      runtime = new M3WardrobeRuntime(mount, (next) => { if (live) setState(next); });
      runtimeRef.current = runtime;
      void runtime.initialize();
    } catch (err) {
      setState((before) => ({
        ...before,
        error: err instanceof Error ? err.message : String(err),
        message: "Thiết bị không khởi tạo được WebGL.",
      }));
    }
    return () => {
      live = false;
      runtime?.dispose();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, []);

  const equip = async (slot: WardrobeSlot, id: string) => {
    if (!runtimeRef.current || !state.ready || loadingSlot) return;
    setLoadingSlot(slot);
    try { await runtimeRef.current.equip(slot, id); }
    finally { setLoadingSlot(null); }
  };

  return (
    <main className="m3-lab" data-testid="m3-modular-wardrobe">
      <header className="m3-head">
        <div className="m3-eyebrow">AUDITION MOBILE MVP / MODULAR RESEARCH</div>
        <h1>Wardrobe <span>Studio</span> <small>V1</small></h1>
        <p>M3 / Drophunter — một body, nhiều skinned garment. Chỉ dùng cho thử nghiệm riêng; không thay nhân vật Vita hoặc gameplay hiện tại.</p>
      </header>
      <div className="m3-grid">
        <section className="m3-stage-card" aria-label="Nhân vật 3D">
          <div className="m3-stage-top">
            <span className="m3-dot" /> Drophunter / shared rig
            <span className="m3-demo-badge">RESEARCH DEMO</span>
          </div>
          <div className="m3-viewport" ref={mountRef} data-testid="m3-stage">
            {!state.ready && <div className="m3-loading">Đang nạp VRM và kiểm tra skeleton…</div>}
          </div>
          <div className="m3-cameras" aria-label="Góc nhìn">
            <button type="button" onClick={() => runtimeRef.current?.setView("front")} disabled={!state.ready}>Chính diện</button>
            <button type="button" onClick={() => runtimeRef.current?.setView("left")} disabled={!state.ready}>Góc trái</button>
            <button type="button" onClick={() => runtimeRef.current?.setView("back")} disabled={!state.ready}>Phía sau</button>
            <button type="button" className="m3-dance" onClick={() => runtimeRef.current?.setDance(!state.moving)} disabled={!state.ready}>
              {state.moving ? "❚❚ Dừng nhảy" : "▶ Nhảy 110 BPM"}
            </button>
          </div>
          <div className="m3-status" role="status" data-testid="m3-status" aria-live="polite">
            {state.error ? <strong>⚠ {state.message} {state.error}</strong> : state.message}
          </div>
          <div className="m3-metrics" data-testid="m3-metrics">
            <span><b>{state.bones}</b> joints</span>
            <span><b>{state.mixerCount}</b> mixer</span>
            <span><b>{state.baseReloads}</b> base loads</span>
            <span><b>{state.cacheSize}</b> cached files</span>
          </div>
        </section>
        <section className="m3-editor" aria-label="Chọn trang phục">
          <div className="m3-editor-top"><h2>Phối đồ</h2><span>4 slots độc lập</span></div>
          {(Object.keys(LABELS) as WardrobeSlot[]).map((slot) => (
            <div className="m3-group" key={slot}>
              <div className="m3-group-head"><span>{LABELS[slot].icon} {LABELS[slot].name}</span><small>{state.equipped[slot] || "Chưa chọn"}</small></div>
              <div className="m3-options">
                {WARDROBE[slot].map((item) => (
                  <button key={item.id} type="button"
                    className={state.equipped[slot] === item.id ? "active" : ""}
                    aria-pressed={state.equipped[slot] === item.id}
                    disabled={!state.ready || Boolean(loadingSlot)}
                    onClick={() => void equip(slot, item.id)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="m3-tech">
            <h3>QA / Kiến trúc</h3>
            <p>Mỗi item phải trùng thứ tự bone và inverse bind matrices với base (sai số ≤ 0,0001). Khi thay đồ, demo giữ một skeleton và một AnimationMixer; không tải lại actor.</p>
            <p>Dance 110 BPM là clip thử nghiệm cục bộ, <strong>không phải animation/gameplay clock của Audition</strong>. Chưa kiểm chứng clipping hay hiệu suất 5 người trên iPhone.</p>
            <p>Asset từ GitHub bên thứ ba, tải trực tiếp vào trình duyệt; chưa có quyền phân phối xác nhận. Không đóng gói VRM trong repository.</p>
            <a href="https://github.com/memelotsqui/character-assets/tree/main/drophunter" target="_blank" rel="noopener noreferrer">Xem nguồn Drophunter</a>
          </div>
        </section>
      </div>
      <footer className="m3-foot">Isolated QA route · không kết nối RoomState, Supabase, WebAudio hoặc Character Catalog production.</footer>
    </main>
  );
}
