"use client";

import { useEffect, useState } from "react";
import { MIXAMO_GROUPS, type MixamoGesture } from "../../../components/character/mixamo-lobby-data";
import {
  poses,
  rigPool,
  type Feet,
  type IdleId,
} from "../../../components/character/motion/stances";

type Pacing = { target: number; drawP95Ms: number; animationMeanMs: number; renderSubmitMeanMs: number; cappedMs: number };
type Sample = {
  id: string;
  target: string | null;
  feet: Feet;
  contact: string;
  drift: number;
  floor: number;
  time: number;
};
function placement(feet: Feet) {
  return feet
    .map((shoe) => shoe.map((n) => n.toFixed(2)).join(" / "))
    .join(" | ");
}
export default function MotionControls({
  family,
  pilot = false,
  mixed = false,
  mixamo = false,
}: {
  family: keyof typeof rigPool;
  pilot?: boolean;
  mixed?: boolean;
  mixamo?: boolean;
}) {
  const [id, setId] = useState<IdleId | MixamoGesture>(
    mixamo ? MIXAMO_GROUPS[family].base[0] : rigPool[family][0],
  );
  const [open, setOpen] = useState(pilot || mixamo);
  const optionsFor = (rig: keyof typeof rigPool) =>
    [...MIXAMO_GROUPS[rig].base, ...MIXAMO_GROUPS[rig].emote, ...MIXAMO_GROUPS[rig].manual];
  const options = mixamo
    ? (mixed
        ? Array.from(new Set([...optionsFor("drophunter"), ...optionsFor("neurohacker")]))
        : optionsFor(family))
    : (mixed ? [...rigPool.drophunter, ...rigPool.neurohacker] : rigPool[family]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [pacing, setPacing] = useState<Pacing | null>(null);
  useEffect(() => {
    if (!pilot) return;
    const stage = document.querySelector<HTMLElement>("[data-testid=waiting-room-stage]");
    if (!stage) return;
    let started = false;
    const start = () => {
      if (started || stage.dataset.stageReady !== "1") return;
      started = true;
      window.dispatchEvent(new CustomEvent("m3-idle-review", { detail: { command: "select", id: "F01" } }));
      window.dispatchEvent(new CustomEvent("m3-idle-review", { detail: { command: "camera", value: "front" } }));
    };
    const observer = new MutationObserver(start);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-stage-ready"] });
    start();
    return () => observer.disconnect();
  }, [pilot]);
  useEffect(() => {
    const stage = document.querySelector<HTMLElement>(
      "[data-testid=waiting-room-stage]",
    );
    if (!open || !stage) return;
    const update = () => {
      setSamples(JSON.parse(stage.dataset.m3MotionReview ?? "[]"));
      setPacing(JSON.parse(stage.dataset.m3Pacing ?? "null"));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(stage, {
      attributes: true,
      attributeFilter: ["data-m3-motion-review"],
    });
    return () => observer.disconnect();
  }, [open]);
  const send = (command: string, value?: string | number) =>
    window.dispatchEvent(
      new CustomEvent("m3-idle-review", { detail: { command, id, value } }),
    );
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      style={{
        position: "fixed",
        left: 4,
        bottom: 4,
        zIndex: 100,
        background: "#101825ee",
        color: "white",
        padding: 6,
        fontSize: 12,
        maxWidth: "96vw",
        maxHeight: "50vh",
        overflow: "auto",
      }}
    >
      <summary>Kiểm tra chuyển động M3{mixamo ? " · Mixamo All 10" : ""}</summary>
      {mixamo && <p>10 Mixamo clips · 17 tổ hợp rig; Catwalk chỉ chọn thủ công</p>}
      {pilot && <p>F01 Blender V1.9.3 · Chờ duyệt hình ảnh</p>}
      <nav>
        <a href={mixamo ? "?m3=female&mixamo=1" : "?m3=female"}>Nữ</a> · <a href={mixamo ? "?m3=male&mixamo=1" : "?m3=male"}>Nam</a> ·{" "}
        <a href={mixamo ? "?m3=five&allM3=1&mixamo=1" : "?m3=five&allM3=1"}>Năm người</a> ·{" "}
        <a href={mixamo ? "?m3=five&allM3=1" : "?m3=five&allM3=1&mixamo=1"}>{mixamo ? "Blender V1.9.3" : "Mixamo All 10"}</a>
      </nav>
      <select
        aria-label="Động tác"
        value={id}
        onChange={(e) => setId(e.target.value as IdleId | MixamoGesture)}
      >
        {options.map((key) => (
          <option key={key}>{key}</option>
        ))}
      </select>{" "}
      <button onClick={() => send("select")}>Phát lại</button> ·{" "}
      <button onClick={() => send("transition")}>Chuyển đến</button> ·{" "}
      <button onClick={() => send("random")}>Ngẫu nhiên</button>
      <div>
        <button onClick={() => send("camera", "front")}>Chính diện</button> ·{" "}
        <button onClick={() => send("camera", "side")}>Góc nghiêng</button> ·{" "}
        <button onClick={() => send("speed", 1)}>1×</button> ·{" "}
        <button onClick={() => send("speed", 0.25)}>0,25×</button>
      </div>
      {pacing && <div>
        Mục tiêu {pacing.target} hình/s · P95 {pacing.drawP95Ms.toFixed(1)} ms ·
        cập nhật M3 {pacing.animationMeanMs.toFixed(1)} ms · gửi lệnh vẽ {pacing.renderSubmitMeanMs.toFixed(1)} ms ·
        thời gian bỏ qua {pacing.cappedMs.toFixed(0)} ms
      </div>}
      {samples.map((s, i) => (
        <div key={i}>
          <strong>
            {s.id} · {s.time.toFixed(1)} s {s.target && "→ " + s.target}
          </strong>{" "}
          · {s.contact}
          <div>Trái | Phải (ngang / sâu / cao / góc): {placement(s.feet)}</div>
          {s.target && !mixamo && <div>Đích: {placement(poses[s.target as IdleId].feet)}</div>}
          <div>
            Sai số cổ chân khi trụ {s.drift.toFixed(5)} · Thấp hơn mốc cổ chân{" "}
            {s.floor.toFixed(5)}
          </div>
        </div>
      ))}
    </details>
  );
}
