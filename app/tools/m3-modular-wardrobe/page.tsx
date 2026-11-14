"use client";

import { useEffect, useRef, useState } from "react";
import {
  M3WardrobeRuntime, WARDROBE, unavailableReason,
  type AvatarKind, type WardrobeSlot, type WardrobeSnapshot,
} from "./runtime";
import { MALE_WARDROBE, MALE_SLOTS, MALE_OPTIONAL_SLOTS } from "./male-catalog";
import { STREET_WARDROBE, STREET_SLOTS, STREET_OPTIONAL_SLOTS, STREET_SOLO_TOPS, streetUnavailableReason } from "./street-catalog";
import { MOTIONS } from "./motions";
import "./m3-wardrobe.css";

const LABELS: Record<WardrobeSlot, { icon: string; name: string }> = {
  top: { icon: "✦", name: "Áo" },
  bottom: { icon: "◈", name: "Quần / váy" },
  shoes: { icon: "◉", name: "Giày" },
  hair: { icon: "✿", name: "Tóc" },
  outer: { icon: "❖", name: "Áo khoác" },
  accessory: { icon: "◇", name: "Phụ kiện" },
  head: { icon: "♧", name: "Mũ / đầu" },
  hands: { icon: "◈", name: "Găng tay" },
  neck: { icon: "♢", name: "Trang sức cổ" },
  waist: { icon: "❂", name: "Đai lưng" },
};

const FEMALE_SLOTS: WardrobeSlot[] = ["top", "bottom", "shoes", "hair", "outer", "accessory"];
const FEMALE_OPTIONAL = new Set<WardrobeSlot>(["outer", "accessory"]);
const DEFAULT_EQUIPPED: Record<WardrobeSlot, string | null> = {
  top: null, bottom: null, shoes: null, hair: null, outer: null, accessory: null,
  head: null, hands: null, neck: null, waist: null,
};
function emptySnapshot(kind: AvatarKind): WardrobeSnapshot {
  return {
    ready: false, message: "Đang tạo sân khấu...", error: null,
    bones: 0, mixerCount: 0, baseReloads: 0, equipped: { ...DEFAULT_EQUIPPED },
    cacheSize: 0, moving: true, maxBindDelta: 0, eyesReady: false,
    avatarKind: kind, motionId: "groove", motionTracks: 0,
  };
}

export default function M3ModularWardrobePage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<M3WardrobeRuntime | null>(null);
  const [avatarKind, setAvatarKind] = useState<AvatarKind>("female");
  const [state, setState] = useState<WardrobeSnapshot>(() => emptySnapshot("female"));
  const [loadingSlot, setLoadingSlot] = useState<WardrobeSlot | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let live = true;
    let runtime: M3WardrobeRuntime | null = null;
    try {
      runtime = new M3WardrobeRuntime(mount, (next) => { if (live) setState(next); }, avatarKind);
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
  }, [avatarKind]);

  const chooseAvatar = (next: AvatarKind) => {
    if (next === avatarKind) return;
    // A gender/body switch is an explicit actor-identity change. Outfit
    // changes on a selected character never recreate actor/mixer.
    setLoadingSlot(null);
    setState(emptySnapshot(next));
    setAvatarKind(next);
  };

  const equip = async (slot: WardrobeSlot, id: string) => {
    if (!runtimeRef.current || !state.ready || loadingSlot) return;
    setLoadingSlot(slot);
    try { await runtimeRef.current.equip(slot, id); }
    finally { setLoadingSlot(null); }
  };

  const anata = avatarKind === "male";
  const street = avatarKind === "male-street";
  const male = anata || street;
  const slots = street ? STREET_SLOTS : anata ? MALE_SLOTS : FEMALE_SLOTS;
  const optional = street ? new Set<WardrobeSlot>(STREET_OPTIONAL_SLOTS) : anata ? new Set<WardrobeSlot>(MALE_OPTIONAL_SLOTS) : FEMALE_OPTIONAL;
  const catalog = street ? STREET_WARDROBE : anata ? MALE_WARDROBE : WARDROBE;
  const count = slots.reduce((sum, slot) => sum + (catalog[slot]?.length ?? 0), 0);

  return (
    <main className="m3-lab" data-testid="m3-modular-wardrobe">
      <header className="m3-head">
        <div className="m3-eyebrow">AUDITION MOBILE MVP / MODULAR RESEARCH</div>
        <h1>Wardrobe <span>Studio</span> <small>V1.4</small></h1>
        <p>Thử thêm nam Streetwear (Neurohacker Experimental) bên cạnh nữ Drophunter và nam Anata. Khung 3D vẫn sticky trên iPhone.</p>
      </header>
      <div className="m3-grid">
        <section className="m3-stage-card" aria-label="Nhân vật 3D" data-testid="m3-sticky-preview">
          <div className="m3-stage-top">
            <span className="m3-dot" />
            <div className="m3-avatar-tabs" role="group" aria-label="Chọn nhân vật">
              <button type="button" className={!male ? "active" : ""} aria-pressed={!male} onClick={() => chooseAvatar("female")} data-testid="m3-avatar-female">Nữ · Drophunter</button>
              <button type="button" className={street ? "active" : ""} aria-pressed={street} onClick={() => chooseAvatar("male-street")} data-testid="m3-avatar-male-street" aria-label="Nam Streetwear Neurohacker thử nghiệm">Nam · Street</button>
              <button type="button" className={anata ? "active" : ""} aria-pressed={anata} onClick={() => chooseAvatar("male")} data-testid="m3-avatar-male">Nam · Anata</button>
            </div>
            <span className="m3-demo-badge" data-testid="m3-eyes-status">{anata ? "55-JOINT RIG" : state.eyesReady ? "EYES ✓" : "EYES —"}</span>
          </div>
          <div className="m3-viewport" ref={mountRef} data-testid="m3-stage">
            {!state.ready && <div className="m3-loading">Đang nạp VRM và kiểm tra skeleton…</div>}
          </div>
          <div className="m3-cameras" aria-label="Góc nhìn">
            <button type="button" onClick={() => runtimeRef.current?.setView("front")} disabled={!state.ready}>Chính diện</button>
            <button type="button" onClick={() => runtimeRef.current?.setView("left")} disabled={!state.ready}>Góc trái</button>
            <button type="button" onClick={() => runtimeRef.current?.setView("back")} disabled={!state.ready}>Phía sau</button>
            <button type="button" className="m3-dance" onClick={() => runtimeRef.current?.setDance(!state.moving)} disabled={!state.ready}>
              {state.moving ? "❚❚ Dừng nhảy" : "▶ Tiếp tục"}
            </button>
          </div>
        </section>

        <section className="m3-diagnostics" aria-label="Trạng thái và animation">
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
            <p>Cùng một mixer cho mỗi base. Bài test chuyển động không dùng WebAudio/gameplay của Audition.</p>
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
          <div className="m3-editor-top"><h2>Phối đồ</h2><span>{count} món · {slots.length} nhóm</span></div>
          <p className="m3-swipe-hint">Vuốt ngang trong từng nhóm để thử các món đồ. Các VRM chỉ tải khi bạn chọn, không tải toàn bộ kho.</p>
          {slots.map((slot) => {
            const selected = state.equipped[slot];
            const options = catalog[slot] ?? [];
            return (
              <section className="m3-group" key={slot} aria-label={LABELS[slot].name}>
                <div className="m3-group-head"><span>{LABELS[slot].icon} {LABELS[slot].name}</span><small>{selected || "Không mặc"} · {options.length} mẫu</small></div>
                <div className="m3-options">
                  {optional.has(slot) && (
                    <button type="button" className={!selected ? "active" : ""} aria-pressed={!selected}
                      disabled={!state.ready || Boolean(loadingSlot)} onClick={() => void equip(slot, "none")}>
                      Không mặc
                    </button>
                  )}
                  {options.map((item) => {
                    const unavailable = street ? streetUnavailableReason(slot, item.id, state.equipped) : male ? null : unavailableReason(slot, item.id, state.equipped);
                    return (
                      <button key={item.id} type="button" title={unavailable || item.label}
                        className={selected === item.id ? "active" : ""}
                        aria-pressed={selected === item.id}
                        disabled={!state.ready || Boolean(loadingSlot) || Boolean(unavailable)}
                        onClick={() => void equip(slot, item.id)}>
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                {street && slot === "outer" && STREET_SOLO_TOPS.has(state.equipped.top || "") &&
                  <p className="m3-restriction">Áo Streetwear/Full Jacket là kiểu solo, cần đổi áo trước khi mặc áo khoác.</p>}
                {!male && slot === "outer" && ["hoodie", "dress", "fulljacket"].includes(state.equipped.top || "") &&
                  <p className="m3-restriction">M3 không cho mặc áo khoác ngoài hoodie hoặc áo nguyên bộ.</p>}
                {!male && slot === "shoes" && ["cargopants", "doublebeltpants", "jumpsuitpants"].includes(state.equipped.bottom || "") &&
                  <p className="m3-restriction">Một số boots cao bị khóa khi mặc quần dài.</p>}
              </section>
            );
          })}
          <div className="m3-tech">
            <h3>QA / Kiến trúc</h3>
            {street ? (
              <>
                <p><strong>EXPERIMENTAL · chưa iPhone PASS.</strong> Neurohacker từ cùng hệ M3, có áo, quần, giày, tóc và phụ kiện VRM tách rời. Mỗi item được kiểm tra lại bone/order/inverse-bind ngay khi nạp; lỗi không được thay bằng model giả.</p>
                <p>Ba mẫu tóc nguồn đã xác minh 102 joints và inverse-bind khớp nhau. Skeleton body và garment lớn cần qua runtime gate thực tế. Giữ một actor + một mixer cho các lần thay đồ.</p>
                <a href="https://github.com/memelotsqui/character-assets/tree/main/neurohacker" target="_blank" rel="noopener noreferrer">Nguồn Neurohacker</a>
              </>
            ) : male ? (
              <>
                <p>Anata Male là bộ modular fantasy để thử cơ chế nam: một base 55 joints, các trait áo, mũ, găng, giày, cổ và đai riêng. Không có slot tóc/quần độc lập trong manifest này.</p>
                <p>Khi chọn Nam ↔ Nữ, demo chủ động thay nhân vật vì mỗi base có rig khác nhau; khi thay quần áo, mixer và actor phải giữ nguyên.</p>
                <a href="https://github.com/M3-org/loot-assets/tree/main/anata/male" target="_blank" rel="noopener noreferrer">Nguồn Anata Male</a>
              </>
            ) : (
              <>
                <p>Drophunter có Eyes bắt buộc, 198 joints, 44 món trong 6 nhóm. Tiếp tục dùng nguyên avatar và hệ phối đồ đã được thử trên iPhone.</p>
                <p>Áo khoác, boots cao và Leg Strap theo hạn chế của manifest. Chưa có body occlusion hoặc springbone physics đầy đủ.</p>
                <a href="https://github.com/memelotsqui/character-assets/tree/main/drophunter" target="_blank" rel="noopener noreferrer">Nguồn Drophunter</a>
              </>
            )}
            <p>Đây là Preview QA. Asset tải trực tiếp từ nguồn thứ ba, chưa xác nhận quyền phân phối thương mại; không đóng gói raw VRM vào repo.</p>
          </div>
        </section>
      </div>
      <footer className="m3-foot">Isolated QA route · không kết nối RoomState, Supabase, WebAudio hoặc Character Catalog production.</footer>
    </main>
  );
}
