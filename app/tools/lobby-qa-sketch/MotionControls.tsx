"use client";

import { useEffect, useState } from "react";
import { MIXAMO_AUTO_GROUPS, STATIONARY_MIXAMO_GROUPS, type MixamoGesture } from "../../../components/character/mixamo-lobby-data";
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
  contactSlip?: number;
  crossfadeSlip?: number;
  poseGap?: number;
  transitionCount?: number;
  steps?: number;
  stepsV6?: number;
  v8?: {
    leftCm:number;rightCm:number;
    crossfadeLeftCm:number;crossfadeRightCm:number;
    segments:number;
    transitions:Array<{from:string;to:string;support:readonly [boolean,boolean];
      soleGapCm:readonly [number,number];fadeSeconds:number}>;
  } | null;
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
  footLock = false,
  contactV4 = true,
  pelvisFix = false,
  sideStepV5 = false,
  sideStepV6 = false,
  contactV7 = false,
  contactV8 = false,
  stationaryOnly = false,
  armStretchV10 = false,
  greetingV11 = false,
  sideStepDemo = false,
}: {
  family: keyof typeof rigPool;
  pilot?: boolean;
  mixed?: boolean;
  mixamo?: boolean;
  footLock?: boolean;
  contactV4?: boolean;
  pelvisFix?: boolean;
  sideStepV5?: boolean;
  sideStepV6?: boolean;
  contactV7?: boolean;
  contactV8?: boolean;
  stationaryOnly?: boolean;
  armStretchV10?: boolean;
  greetingV11?: boolean;
  sideStepDemo?: boolean;
}) {
  const [id, setId] = useState<IdleId | MixamoGesture>(
    mixamo ? (stationaryOnly ? STATIONARY_MIXAMO_GROUPS : MIXAMO_AUTO_GROUPS)[family].base[0] : rigPool[family][0],
  );
  const [open, setOpen] = useState(pilot || mixamo);
  const optionsFor = (rig: keyof typeof rigPool) => {
    const pool = (stationaryOnly ? STATIONARY_MIXAMO_GROUPS : MIXAMO_AUTO_GROUPS)[rig];
    return [...pool.base, ...(armStretchV10?["arm-stretching" as const]:[]),
      ...(greetingV11?["standing-greeting-2" as const]:[]),
      ...pool.emote, ...pool.manual];
  };
  const options = mixamo
    ? (mixed
        ? Array.from(new Set([...optionsFor("drophunter"), ...optionsFor("neurohacker")]))
        : optionsFor(family))
    : (mixed ? [...rigPool.drophunter, ...rigPool.neurohacker] : rigPool[family]);
  const qaLink = (
    familyMode: "female" | "male" | "five",
    changes: Partial<Record<"mixamo" | "footLock" | "contactV4" | "pelvisFix" | "sideStepV5" | "sideStepV6" | "contactV7" | "contactV8" | "stationaryOnly" | "armStretchV10" | "greetingV11" | "sideStepDemo", boolean>> = {},
  ) => {
    const opts = {mixamo, footLock, contactV4, pelvisFix, sideStepV5, sideStepV6, contactV7, contactV8, stationaryOnly, armStretchV10, greetingV11, sideStepDemo, ...changes};
    const params = new URLSearchParams({m3:familyMode});
    if (familyMode === "five") params.set("allM3", "1");
    if (opts.mixamo) {
      params.set("mixamo", "1");
      if (opts.footLock) params.set("footLock", "1");
      else {
        params.set("contactV4", opts.contactV4 ? "1" : "0");
        if (opts.pelvisFix) params.set("pelvisFix", "1");
        if (opts.sideStepV5 && !opts.sideStepV6) params.set("sideStepV5", "1");
        if (opts.sideStepV6) params.set("sideStepV6", "1");
        if (opts.contactV7) params.set("contactV7", "1");
        if (opts.contactV8) params.set("contactV8", "1");
        if (opts.stationaryOnly) params.set("stationaryOnly", "1");
        if (opts.armStretchV10) params.set("armStretchV10", "1");
        if (opts.greetingV11) params.set("greetingV11", "1");
        if (opts.sideStepDemo && !opts.stationaryOnly) params.set("sideStepDemo", "1");
      }
    }
    return "?" + params.toString();
  };
  const currentMode = mixed ? "five" : family === "drophunter" ? "female" : "male";
  const [samples, setSamples] = useState<Sample[]>([]);
  const [demoPlayed, setDemoPlayed] = useState(false);
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
    if (!mixamo || stationaryOnly || !sideStepDemo || demoPlayed) return;
    const stage = document.querySelector<HTMLElement>("[data-testid=waiting-room-stage]");
    if (!stage) return;
    const start = () => {
      const needed = mixed ? 5 : 1;
      if (stage.dataset.stageReady !== "1" ||
          Number(stage.dataset.m3IdleCount ?? "0") !== needed ||
          (sideStepV6
            ? stage.dataset.m3SideStepV6 !== "1"
            : sideStepV5
              ? stage.dataset.m3SideStepV5 !== "1"
              : stage.dataset.m3MixamoEnabled !== "1")) return;
      window.dispatchEvent(new CustomEvent("m3-idle-review", {
        detail: {command:"select", id:"bored"},
      }));
      setId("bored");
      setDemoPlayed(true);
    };
    const observer = new MutationObserver(start);
    observer.observe(stage, {attributes:true, attributeFilter:[
      "data-stage-ready", "data-m3-idle-count", "data-m3-side-step-v5",
      "data-m3-side-step-v6", "data-m3-mixamo-enabled",
    ]});
    start();
    return () => observer.disconnect();
  }, [mixamo, sideStepDemo, sideStepV5, sideStepV6, demoPlayed, mixed, stationaryOnly]);
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
      <summary>
        Kiểm tra chuyển động M3{mixamo ? " · Mixamo All 10" : ""}
        {mixamo && " · V5 " + (sideStepV5 && !sideStepV6 && contactV4 && !footLock ? "BẬT" : "TẮT")}
        {mixamo && " · V6 " + (sideStepV6 && contactV4 && !footLock ? "BẬT" : "TẮT")}
        {mixamo && " · Contact V7 " + (contactV7 && contactV4 && !footLock ? "BẬT" : "TẮT")}
        {mixamo && " · V8 " + (contactV8 && contactV7 && !footLock ? "BẬT" : "TẮT")}
        {mixamo && stationaryOnly && " · STATIONARY ONLY"}
        {mixamo && armStretchV10 && " · ARM STRETCH V10"}
        {mixamo && greetingV11 && " · STANDING GREETING V11"}
        {mixamo && sideStepDemo && " · Bored demo"}
      </summary>
      {mixamo && <p>
        {stationaryOnly
          ? "V9 lọc: Breathing Idle 2; nam thêm Warrior Idle; emote Pointing, nữ thêm Blow a Kiss."
          : "Danh sách random đã bỏ Dwarf Idle và Dwarf Idle 2 (cả nam/nữ). Bản duyệt từng clip vẫn giữ toàn bộ asset."}
      </p>}
      {mixamo && <p>
        <strong>V10 Arm Stretching — 5 người:</strong> {armStretchV10?"BẬT":"TẮT"}
        {" · "}<a href={qaLink("five",{
          mixamo:true,footLock:false,contactV4:true,pelvisFix:true,
          sideStepV5:false,sideStepV6:false,contactV7:true,contactV8:true,
          stationaryOnly:true,armStretchV10:true,sideStepDemo:false,
        })}>5 người · Random có Arm Stretching</a>
        {" · "}Không Cheering / Dwarf Idle / Dwarf Idle 2.
        {armStretchV10 && <>
          {" · "}<button onClick={()=>{
            window.dispatchEvent(new CustomEvent("m3-idle-review",{
              detail:{command:"select",id:"arm-stretching"},
            }));
            setId("arm-stretching");
          }}>Phát Arm Stretch cả 5</button>
          {" · "}<button onClick={()=>{
            window.dispatchEvent(new CustomEvent("m3-idle-review",{
              detail:{command:"random"},
            }));
          }}>Về random</button>
        </>}
      </p>}
      {mixamo && <p>
        <strong>V11 Standing Greeting 2 — 5 người:</strong> {greetingV11 ? "BẬT" : "TẮT"}
        {" · "}<a href={qaLink("five",{
          mixamo:true,footLock:false,contactV4:true,pelvisFix:true,
          sideStepV5:false,sideStepV6:false,contactV7:true,contactV8:true,
          stationaryOnly:true,armStretchV10:true,greetingV11:true,sideStepDemo:false,
        })}>5 người · Random Arm Stretch + Standing Greeting 2</a>
        {" · "}Không Cheering / Dwarf Idle / Dwarf Idle 2.
        {greetingV11 && <>
          {" · "}<button onClick={()=>{
            window.dispatchEvent(new CustomEvent("m3-idle-review",{
              detail:{command:"select",id:"standing-greeting-2"},
            }));
            setId("standing-greeting-2");
          }}>Phát Greeting cả 5</button>
          {" · "}<button onClick={()=>window.dispatchEvent(new CustomEvent("m3-idle-review",{
            detail:{command:"random"},
          }))}>Về random V11</button>
        </>}
      </p>}
      {mixamo && <p>
        <strong>V9 Stationary Only:</strong> {stationaryOnly ? "BẬT" : "TẮT"}
        {" · "}<a href={qaLink("five", {
          mixamo:true,footLock:false,contactV4:true,pelvisFix:true,
          sideStepV5:false,sideStepV6:false,contactV7:true,contactV8:true,
          stationaryOnly:true,sideStepDemo:false,
        })}>5 người · Random không animation trượt rõ</a>
        {" · "}<a href={qaLink("five", {
          mixamo:true,footLock:false,contactV4:true,pelvisFix:true,
          sideStepV5:false,sideStepV6:true,contactV7:true,contactV8:true,
          stationaryOnly:false,sideStepDemo:false,
        })}>Đối chứng toàn bộ V8</a>
        {" · "}Đã tạm loại khỏi danh sách random:
        Bored, Sad Idle, Dwarf Idle, Dwarf Idle 2, Waving, Catwalk Twist.
      </p>}
      {mixamo && <p>
        <strong>V8 Per-Foot Contact + Transition:</strong>{" "}
        {contactV8 && contactV7 && !footLock ? "BẬT" : "TẮT"}{" · "}
        <a href={qaLink("five",{
          mixamo:true,footLock:false,contactV4:true,pelvisFix:true,
          sideStepV5:false,sideStepV6:true,contactV7:true,contactV8:true,sideStepDemo:false,
        })}>5 người · Random + V8</a>{" · "}
        <a href={qaLink("five",{
          mixamo:true,footLock:false,contactV4:true,pelvisFix:true,
          sideStepV5:false,sideStepV6:true,contactV7:true,contactV8:false,sideStepDemo:false,
        })}>Đối chứng V7</a>
        {" · "}QA: đế chân (heel/toe proxy), clip hiện tại, chân trụ và crossfade
      </p>}
      {mixamo && <p>
        <strong>V7 Contact-aware (toàn bộ Mixamo clips):</strong>{" "}
        {contactV7 && !footLock ? "BẬT" : "TẮT"}{" · "}
        <a href={qaLink(currentMode,{
          mixamo:true,footLock:false,contactV4:true,pelvisFix:true,
          sideStepV5:false,sideStepV6:true,contactV7:true,sideStepDemo:false,
        })}>5 người · Random + V6 + V7</a>{" · "}
        <a href={qaLink(currentMode,{
          mixamo:true,footLock:false,contactV4:true,pelvisFix:true,
          sideStepV5:false,sideStepV6:true,contactV7:false,sideStepDemo:false,
        })}>Đối chứng Random + V6</a>
      </p>}
      {mixamo && <p>
        <strong>V6 Bored side-step:</strong> {sideStepV6 ? "BẬT" : "TẮT"}
        {" · "}<a href={qaLink(currentMode,{
          mixamo:true,footLock:false,contactV4:true,pelvisFix:true,
          sideStepV5:false,sideStepV6:true,sideStepDemo:true,
        })}>Bật V6 + demo Bored</a>
        {" · "}<a href={qaLink(currentMode,{
          mixamo:true,footLock:false,contactV4:true,pelvisFix:true,
          sideStepV5:false,sideStepV6:false,sideStepDemo:true,
        })}>Đối chứng V4+V3</a>
        {" · "}Bước bake: {samples.map(s=>s.stepsV6 ?? 0).join(",") || "đang tải"}
      </p>}
      {mixamo && <p>
        V5: <strong>{sideStepV5 && !footLock && contactV4 ? "BẬT" : "TẮT"}</strong>
        {" · "}Số bước có thể bake trong Bored: {samples.map(s => s.steps ?? 0).join(", ") || "đang tải"}
        {" · "}<a href={qaLink(currentMode, {
          mixamo:true, footLock:false, contactV4:true, pelvisFix:true, sideStepV5:true, sideStepV6:false, sideStepDemo:true,
        })}>Demo Bored (cả 5 nhân vật)</a>
        {" · "}<a href={qaLink(currentMode, {
          mixamo:true, footLock:false, contactV4:true, pelvisFix:true, sideStepV5:false, sideStepV6:false, sideStepDemo:false,
        })}>Đối chứng (tắt V5)</a>
      </p>}
      {mixamo && <p>
        V4: chọn pose chân tương thích và hoàn tất crossfade trước clip cũ.{" "}
        <a href={qaLink(currentMode, {contactV4:true})}>
          Bật V4
        </a>{" · "}
        <a href={qaLink(currentMode, {contactV4:false,sideStepV5:false,sideStepV6:false,sideStepDemo:false})}>
          So sánh bản cũ
        </a>
      </p>}
      {mixamo && <p>
        Foot Lock: {footLock ? "BẬT (thử nghiệm)" : "TẮT (gốc)"} ·{" "}
        <a href={qaLink(currentMode, {footLock:!footLock,sideStepV5:false,sideStepV6:false,sideStepDemo:false})}>
          {footLock ? "So sánh: tắt" : "So sánh: bật"}
        </a>
      </p>}
      {pilot && <p>F01 Blender V1.9.3 · Chờ duyệt hình ảnh</p>}
      <nav>
        <a href={qaLink("female")}>Nữ</a> · <a href={qaLink("male")}>Nam</a> ·{" "}
        <a href={qaLink("five")}>Năm người</a> ·{" "}
        <a href={qaLink("five", {mixamo:!mixamo,sideStepV5:false,sideStepV6:false,sideStepDemo:false})}>{mixamo ? "Blender V1.9.3" : "Mixamo All 10"}</a>
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
          {s.contactSlip !== undefined && <div>
            Contact drift tối đa {(s.contactSlip * 100).toFixed(2)} cm ·
            trong crossfade {((s.crossfadeSlip ?? 0) * 100).toFixed(2)} cm ·
            chênh pose đầu clip {((s.poseGap ?? 0) * 100).toFixed(1)}% chiều cao ·
            {s.transitionCount ?? 0} chuyển tiếp · V5 steps {s.steps ?? 0} · V6 steps {s.stepsV6 ?? 0}
          </div>}
          {s.v8 && <div>
            V8 contact L/R: {s.v8.leftCm.toFixed(2)} / {s.v8.rightCm.toFixed(2)} cm ·
            crossfade L/R: {s.v8.crossfadeLeftCm.toFixed(2)} / {s.v8.crossfadeRightCm.toFixed(2)} cm
            {" · "}{s.v8.segments} đoạn trụ
            {s.v8.transitions.length>0 && <div>
              Last: {s.v8.transitions[s.v8.transitions.length-1].from}
              {" → "}{s.v8.transitions[s.v8.transitions.length-1].to}
              {" · "}Gap L/R: {s.v8.transitions[s.v8.transitions.length-1].soleGapCm
                .map(x=>x.toFixed(1)).join("/")} cm
              {" · "}Fade: {s.v8.transitions[s.v8.transitions.length-1].fadeSeconds.toFixed(2)}s
            </div>}
          </div>}
        </div>
      ))}
    </details>
  );
}
