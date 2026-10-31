"use client";

import { useState } from "react";
import RealHeadPreview from "./RealHeadPreview";
import styles from "./FacialEyeLab.module.css";

type IrisStyle = "natural" | "radiant" | "velvet" | "crystal";
type LashStyle = "natural" | "doll" | "dramatic" | "none";
type CameraView = "front" | "left" | "right" | "close";

type EyeDraft = {
  irisStyleId: IrisStyle;
  irisColor: string;
  eyeScale: number;
  eyeWidth: number;
  eyeHeight: number;
  eyeSpacing: number;
  irisScale: number;
  pupilScale: number;
  lashStyleId: LashStyle;
};

const DEFAULT: EyeDraft = {
  irisStyleId: "natural",
  irisColor: "#94613f",
  eyeScale: 1,
  eyeWidth: 1,
  eyeHeight: 1,
  eyeSpacing: 1,
  irisScale: 1,
  pupilScale: 0.38,
  lashStyleId: "natural",
};

const IRIS_STYLES: { id: IrisStyle; label: string; detail: string }[] = [
  { id: "natural", label: "Natural", detail: "Vân mềm, limbal ring tự nhiên" },
  { id: "radiant", label: "Radiant", detail: "Vân iris rõ, tương phản cao" },
  { id: "velvet", label: "Velvet", detail: "Gradient dịu, tối ở rìa" },
  { id: "crystal", label: "Crystal", detail: "Sợi sáng phân tầng" },
];
const COLORS = ["#94613f", "#b77a35", "#668ab1", "#7f65aa", "#438b87", "#7b5846"];
const LASHES: { id: LashStyle; label: string }[] = [
  { id: "natural", label: "Natural" },
  { id: "doll", label: "Doll" },
  { id: "dramatic", label: "Dramatic" },
  { id: "none", label: "None" },
];

function RangeField({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void;
}) {
  return (
    <label className={styles.rangeField}>
      <span><strong>{label}</strong><output>{Math.round(value * 100)}%</output></span>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value}
        onChange={event => onChange(Number(event.target.value))} />
    </label>
  );
}

export default function FacialModularEyeV1Page() {
  const [draft, setDraft] = useState<EyeDraft>(DEFAULT);
  const [view, setView] = useState<CameraView>("front");
  const [copied, setCopied] = useState(false);
  const patch = (key: keyof EyeDraft, value: string | number) =>
    setDraft(previous => ({ ...previous, [key]: value }));
  const exportDraft = () => JSON.stringify({ schemaVersion: 1, type: "eye-module-poc", ...draft }, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportDraft());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className={styles.page} data-testid="facial-modular-eye-lab">
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.overline}>AUDITION MOBILE · CHARACTER LAB</p>
            <h1>Modular Eye Studio <em>V1</em></h1>
            <p>Thử trực tiếp trên GLB đầu thật của Claude V2: iris, màu sắc và biến dạng cục bộ vùng mắt.</p>
          </div>
          <div className={styles.experimentBadge}>ISOLATED EXPERIMENT</div>
        </header>

        <div className={styles.layout}>
          <section className={styles.previewPanel} aria-label="3D eye module preview">
            <div className={styles.previewTop}>
              <strong>Live 3D preview</strong><span>Real GLB · Chưa tích hợp game</span>
            </div>
            <RealHeadPreview draft={draft} view={view} />
            <div className={styles.viewControl} role="group" aria-label="Góc nhìn">
              {(["front", "left", "right", "close"] as const).map(item => (
                <button type="button" aria-pressed={view === item} className={view === item ? styles.active : ""}
                  key={item} onClick={() => setView(item)}>
                  {item === "front" ? "Chính diện" : item === "left" ? "3/4 trái" : item === "right" ? "3/4 phải" : "Cận mắt"}
                </button>
              ))}
            </div>
            <p className={styles.disclaimer}>Đang dùng GLB modular thật từ Claude V2. Lớp màng mí trên vẫn chưa được sửa; iris và hình dáng là thử nghiệm vật liệu/biến dạng cục bộ. Kiểu lông mi hiện chỉ điều chỉnh độ đậm trên atlas thật, chưa hoán đổi mesh lông mi. Không ghi vào Character Catalog.</p>
          </section>

          <section className={styles.controls} aria-label="Eye customization controls">
            <div className={styles.sectionHeading}><span>01</span><h2>Kiểu tròng mắt</h2></div>
            <div className={styles.presetGrid}>
              {IRIS_STYLES.map(style => (
                <button type="button" key={style.id} aria-pressed={draft.irisStyleId === style.id}
                  className={draft.irisStyleId === style.id ? styles.selectedPreset : styles.preset}
                  onClick={() => patch("irisStyleId", style.id)}>
                  <span className={styles.presetDot} style={{ background: draft.irisColor }} />
                  <strong>{style.label}</strong><small>{style.detail}</small>
                </button>
              ))}
            </div>

            <div className={styles.sectionHeading}><span>02</span><h2>Màu iris</h2></div>
            <div className={styles.swatches}>
              {COLORS.map(color => (
                <button type="button" key={color} aria-label={"Màu iris " + color}
                  aria-pressed={draft.irisColor === color}
                  className={draft.irisColor === color ? styles.activeSwatch : styles.swatch}
                  style={{ backgroundColor: color }} onClick={() => patch("irisColor", color)} />
              ))}
              <label className={styles.colorCustom}>Tùy chỉnh <input type="color" aria-label="Chọn màu iris" value={draft.irisColor}
                onChange={event => patch("irisColor", event.target.value)} /></label>
            </div>

            <div className={styles.sectionHeading}><span>03</span><h2>Hình dáng</h2></div>
            <div className={styles.rangeGrid}>
              <RangeField label="Kích thước mắt" value={draft.eyeScale} min={0.8} max={1.25} step={0.01} onChange={v => patch("eyeScale", v)} />
              <RangeField label="Chiều rộng" value={draft.eyeWidth} min={0.8} max={1.25} step={0.01} onChange={v => patch("eyeWidth", v)} />
              <RangeField label="Chiều cao" value={draft.eyeHeight} min={0.75} max={1.24} step={0.01} onChange={v => patch("eyeHeight", v)} />
              <RangeField label="Khoảng cách hai mắt" value={draft.eyeSpacing} min={0.82} max={1.2} step={0.01} onChange={v => patch("eyeSpacing", v)} />
              <RangeField label="Độ lớn iris" value={draft.irisScale} min={0.76} max={1.18} step={0.01} onChange={v => patch("irisScale", v)} />
              <RangeField label="Đồng tử" value={draft.pupilScale} min={0.25} max={0.52} step={0.01} onChange={v => patch("pupilScale", v)} />
            </div>

            <div className={styles.sectionHeading}><span>04</span><h2>Lông mi · độ đậm atlas thật</h2></div>
            <div className={styles.lashGroup} role="group" aria-label="Kiểu lông mi">
              {LASHES.map(style => (
                <button type="button" key={style.id} aria-pressed={draft.lashStyleId === style.id}
                  onClick={() => patch("lashStyleId", style.id)}>{style.label}</button>
              ))}
            </div>

            <div className={styles.actions}>
              <button type="button" onClick={() => { setDraft(DEFAULT); setView("front"); setCopied(false); }}>Khôi phục mặc định</button>
              <button type="button" onClick={() => void copy()}>{copied ? "Đã copy JSON" : "Copy cấu hình JSON"}</button>
            </div>
            <details className={styles.dataPanel}><summary>Dữ liệu cấu hình hiện tại</summary><pre>{exportDraft()}</pre></details>
          </section>
        </div>
      </div>
    </main>
  );
}
