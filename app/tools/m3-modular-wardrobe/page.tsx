"use client";

import { useEffect, useRef, useState } from "react";
import {
  M3WardrobeRuntime, WARDROBE, unavailableReason,
  type WardrobeSlot, type WardrobeSnapshot,
} from "./runtime";
import { MOTIONS } from "./motions";
import "./m3-wardrobe.css";

const LABELS: Record<WardrobeSlot, { icon: string; name: string }> = {
  top: { icon: "✦", name: "Áo" },
  bottom: { icon: "◈", name: "Quần / váy" },
  shoes: { icon: "◉", name: "Giày" },
  hair: { icon: "✿", name: "Tóc" },
  outer: { icon: "❖", name: "Áo khoác" },
  accessory: { icon: "◇", name: "Phụ kiện" },
};

const SLOTS: WardrobeSlot[] = ["top", "bottom", "shoes", "hair", "outer", "accessory"];
const OPTIONAL_SLOTS = new Set<WardrobeSlot>(["outer", "accessory"]);
const SOURCE = "https://github.com/memelotsqui/character-assets/tree/main/drophunter";

const DEFAULT_STATE: WardrobeSnapshot = {
  ready: false,
  message: "Đang tạo sân khấu...",
  error: null,
  bones: 0,
  mixerCount: 0,
  baseReloads: 0,
  equipped: { top: null, bottom: null, shoes: null, hair: null, outer: null, accessory: null },
  cacheSize: 0,
  moving: true,
  maxBindDelta: 0,
  eyesReady: false,
  motionId: "groove",
  motionTracks: 0,
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
        <h1>Wardrobe <span>Studio</span> <small>V1.2</small></h1>
        <p>M3 / Drophunter — một body, 44 lựa chọn trang phục trong 6 nhóm, 3 bài kiểm tra chuyển động. Demo độc lập, không thay Vita hoặc gameplay.</p>
      </header>
      <div className="m3-grid">
        <section className="m3-stage-card" aria-label="Nhân vật 3D">
          <div className="m3-stage-top">
            <span className="m3-dot" /> Drophunter / shared rig
            <span className="m3-demo-badge" data-testid="m3-eyes-status">{state.eyesReady ? "EYES ✓" : "EYES —"}</span>
          </div>
          <div className="m3-viewport" ref={mountRef} data-testid="m3-stage">
            {!state.ready && <div className="m3-loading">Đang nạp VRM và kiểm tra skeleton…</div>}
          </div>
          <div className="m3-cameras" aria-label="Góc nhìn">
            <button type="button" onClick={() => runtimeRef.current?.setView("front")} disabled={!state.ready}>Chính diện</button>
            <button type="button" onClick={() => runtimeRef.current?.setView("left")} disabled={!state.ready}>Góc trái</button>
            <button type="button" onClick={() => runtimeRef.current?.setView("back")} disabled={!state.ready}>Phía sau</button>
            <button type="button" className="m3-dance" onClick={() => runtimeRef.current?.setDance(!state.moving)} disabled={!state.ready}>
              {state.moving ? "❚❚ Dừng nhảy" : "▶ Tiếp tục nhảy"}
            </button>
          </div>
          <div className="m3-motion-panel" data-testid="m3-motion-panel">
            <div className="m3-motion-heading"><strong>Animation stress test</strong><span>{state.motionTracks} tracks · 110 BPM</span></div>
            <div className="m3-motion-choices" role="group" aria-label="Chọn animation">
              {MOTIONS.map((motion) => (
                <button type="button" key={motion.id}
                  className={state.motionId === motion.id ? "active" : ""}
                  aria-pressed={state.motionId === motion.id}
                  disabled={!state.ready}
                  onClick={() => runtimeRef.current?.setMotion(motion.id)}>
                  <strong>{motion.label}</strong>
                  <small>{motion.description}</small>
                </button>
              ))}
            </div>
            <p>Chuyển động QA tự tạo để phát hiện lỗi áo, váy, tóc và giày khi khớp vai/hông/gối biến dạng. Không phải choreography gameplay Audition.</p>
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
          <div className="m3-editor-top"><h2>Phối đồ</h2><span>44 món · 6 nhóm</span></div>
          <p className="m3-swipe-hint">Vuốt ngang trong từng nhóm để xem thêm đồ. Món mới chỉ được tải khi bạn chọn.</p>
          {SLOTS.map((slot) => {
            const selected = state.equipped[slot];
            const options = WARDROBE[slot];
            return (
              <section className="m3-group" key={slot} aria-label={LABELS[slot].name}>
                <div className="m3-group-head"><span>{LABELS[slot].icon} {LABELS[slot].name}</span><small>{selected || "Không mặc"} · {options.length} mẫu</small></div>
                <div className="m3-options">
                  {OPTIONAL_SLOTS.has(slot) && (
                    <button type="button" className={!selected ? "active" : ""} aria-pressed={!selected}
                      disabled={!state.ready || Boolean(loadingSlot)}
                      onClick={() => void equip(slot, "none")}>
                      Không mặc
                    </button>
                  )}
                  {options.map((item) => {
                    const unavailable = unavailableReason(slot, item.id, state.equipped);
                    return (
                      <button key={item.id} type="button"
                        title={unavailable || item.label}
                        className={selected === item.id ? "active" : ""}
                        aria-pressed={selected === item.id}
                        disabled={!state.ready || Boolean(loadingSlot) || Boolean(unavailable)}
                        onClick={() => void equip(slot, item.id)}>
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                {slot === "outer" && ["hoodie", "dress", "fulljacket"].includes(state.equipped.top || "") &&
                  <p className="m3-restriction">M3 không cho mặc áo khoác ngoài hoodie hoặc áo nguyên bộ.</p>}
                {slot === "shoes" && ["cargopants", "doublebeltpants", "jumpsuitpants"].includes(state.equipped.bottom || "") &&
                  <p className="m3-restriction">Một số boots cao bị khóa khi mặc quần dài.</p>}
              </section>
            );
          })}
          <div className="m3-tech">
            <h3>QA / Kiến trúc</h3>
            <p>Eyes là phần bắt buộc và không bị thay khi đổi đồ. Mỗi garment phải có cùng bone order và inverse bind matrices với base (ngưỡng 0,0001). Demo giữ một skeleton, một AnimationMixer, một lần nạp base.</p>
            <p>Quy tắc phối đồ theo manifest Drophunter được áp dụng cho áo khoác, quần dài/boots cao và Leg Strap. Chưa có body occlusion hoặc springbone physics đầy đủ nên cần kiểm tra clipping khi chuyển động mạnh.</p>
            <p>Tải trực tiếp file bên thứ ba trong trình duyệt; chưa xác nhận giấy phép phân phối. Không đóng gói VRM vào repository.</p>
            <a href={SOURCE} target="_blank" rel="noopener noreferrer">Xem nguồn Drophunter</a>
          </div>
        </section>
      </div>
      <footer className="m3-foot">Isolated QA route · không kết nối RoomState, Supabase, WebAudio hoặc Character Catalog production.</footer>
    </main>
  );
}
