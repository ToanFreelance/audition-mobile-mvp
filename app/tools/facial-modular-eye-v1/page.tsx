"use client";

import { useState } from "react";
import RealHeadPreview from "./RealHeadPreview";
import type { EyeDraft, EyeShapeId, IrisPatternId, EyeView } from "./RealHeadPreview";
import styles from "./FacialEyeLab.module.css";

type IrisStyle = EyeDraft["irisStyleId"];
type LashStyle = EyeDraft["lashStyleId"];
type CameraView = EyeView;

const DEFAULT: EyeDraft = {
  eyeShapeId: "neutral",
  irisPatternId: "classic",
  blinkEnabled: true,
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
const SHAPES: { id: EyeShapeId; icon: string; label: string; detail: string }[] = [
  { id: "neutral", icon: "◉", label: "Tự nhiên", detail: "Mắt gốc" },
  { id: "joyful", icon: "😊", label: "Mắt vui", detail: "Khóe mắt nâng, hơi híp" },
  { id: "sad", icon: "🥺", label: "Mắt buồn", detail: "Đuôi mắt hạ nhẹ" },
  { id: "angry", icon: "😠", label: "Mắt giận", detail: "Đầu mí hạ, ánh nhìn sắc" },
  { id: "surprised", icon: "😲", label: "Ngạc nhiên", detail: "Mắt mở rộng" },
  { id: "playful", icon: "😉", label: "Tinh nghịch", detail: "Lệch mí nhẹ một bên" },
];
const PATTERNS: { id: IrisPatternId; icon: string; label: string }[] = [
  { id: "classic", icon: "◉", label: "Tự nhiên" },
  { id: "heart", icon: "♥", label: "Trái tim" },
  { id: "star", icon: "★", label: "Ngôi sao" },
  { id: "sparkle", icon: "✦", label: "Lấp lánh" },
  { id: "spiral", icon: "◎", label: "Xoáy" },
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
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const patch = (key: keyof EyeDraft, value: string | number | boolean) =>
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
            <h1>Modular Eye Studio <em>V1.3</em></h1>
            <p>Chọn dáng mắt, cảm xúc, hoa văn và lông mi trên GLB Claude V2; quan sát trực tiếp khi chỉnh.</p>
          </div>
          <div className={styles.experimentBadge}>ISOLATED EXPERIMENT</div>
        </header>

        <div className={styles.layout}>
          <section className={styles.previewPanel} aria-label="3D eye module preview">
            <div className={styles.previewTop}>
              <strong>Live 3D preview</strong><span>GLB Claude V2 · Thử nghiệm</span>
            </div>
            <RealHeadPreview draft={draft} view={view} resetToken={cameraResetToken} />
            <div className={styles.viewControl} role="group" aria-label="Góc nhìn">
              {(["front", "left", "right", "close"] as const).map(item => (
                <button type="button" aria-pressed={view === item} className={view === item ? styles.active : ""}
                  key={item} onClick={() => setView(item)}>
                  {item === "front" ? "Chính diện" : item === "left" ? "3/4 trái" : item === "right" ? "3/4 phải" : "Cận mắt"}
                </button>
              ))}
            </div>
            <div className={styles.previewHint}>
              <span>☝️ Xoay · 🤏 Zoom · ✌️ Kéo</span>
              <div className={styles.previewActions}>
                <button type="button" aria-pressed={draft.blinkEnabled} aria-label="Chớp mắt tự nhiên" onClick={() => patch("blinkEnabled", !draft.blinkEnabled)}>Chớp mắt {draft.blinkEnabled ? "ON" : "OFF"}</button>
                <button type="button" onClick={() => setCameraResetToken(value => value + 1)}>Reset camera</button>
              </div>
            </div>
          </section>

          <section className={styles.controls} aria-label="Eye customization controls">
            <div className={styles.sectionHeading}><span>01</span><h2>Dáng mắt và biểu cảm</h2></div>
            <p className={styles.sectionDescription}>Preset chỉnh vùng mí và da quanh mắt trên GLB thật. Đây là shape preview, chưa phải blink morph đã nghiệm thu.</p>
            <div className={styles.shapeGrid}>
              {SHAPES.map(shape => (
                <button type="button" key={shape.id} aria-pressed={draft.eyeShapeId === shape.id}
                  className={draft.eyeShapeId === shape.id ? styles.selectedShape : styles.shapePreset}
                  onClick={() => patch("eyeShapeId", shape.id)}>
                  <span aria-hidden="true" className={styles.shapeIcon}>{shape.icon}</span>
                  <strong>{shape.label}</strong>
                  <small>{shape.detail}</small>
                </button>
              ))}
            </div>

            <div className={styles.sectionHeading}><span>02</span><h2>Hoa văn tròng mắt</h2></div>
            <p className={styles.sectionDescription}>Hoa văn fantasy thay thế iris cũ, không vẽ chồng lên tròng mắt.</p>
            <div className={styles.patternGrid}>
              {PATTERNS.map(pattern => (
                <button type="button" key={pattern.id} aria-pressed={draft.irisPatternId === pattern.id}
                  className={draft.irisPatternId === pattern.id ? styles.selectedPattern : styles.patternPreset}
                  onClick={() => patch("irisPatternId", pattern.id)}>
                  <span className={styles.patternIcon} aria-hidden="true">{pattern.icon}</span>
                  <span>{pattern.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.sectionHeading}><span>03</span><h2>Kiểu tròng mắt</h2></div>
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

            <div className={styles.sectionHeading}><span>04</span><h2>Màu iris</h2></div>
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

            <div className={styles.sectionHeading}><span>05</span><h2>Thông số chi tiết</h2></div>
            <div className={styles.rangeGrid}>
              <RangeField label="Kích thước mắt" value={draft.eyeScale} min={0.8} max={1.25} step={0.01} onChange={v => patch("eyeScale", v)} />
              <RangeField label="Chiều rộng" value={draft.eyeWidth} min={0.8} max={1.25} step={0.01} onChange={v => patch("eyeWidth", v)} />
              <RangeField label="Chiều cao" value={draft.eyeHeight} min={0.75} max={1.24} step={0.01} onChange={v => patch("eyeHeight", v)} />
              <RangeField label="Khoảng cách hai mắt" value={draft.eyeSpacing} min={0.82} max={1.2} step={0.01} onChange={v => patch("eyeSpacing", v)} />
              <RangeField label="Độ lớn iris" value={draft.irisScale} min={0.76} max={1.18} step={0.01} onChange={v => patch("irisScale", v)} />
              <RangeField label="Đồng tử" value={draft.pupilScale} min={0.25} max={0.52} step={0.01} onChange={v => patch("pupilScale", v)} />
            </div>

            <div className={styles.sectionHeading}><span>06</span><h2>Lông mi · 3D variants</h2></div>
            <div className={styles.lashGroup} role="group" aria-label="Kiểu lông mi">
              {LASHES.map(style => (
                <button type="button" key={style.id} aria-pressed={draft.lashStyleId === style.id}
                  onClick={() => patch("lashStyleId", style.id)}>{style.label}</button>
              ))}
            </div>

            <div className={styles.actions}>
              <button type="button" onClick={() => { setDraft(DEFAULT); setView("front"); setCameraResetToken(value => value + 1); setCopied(false); }}>Khôi phục mặc định</button>
              <button type="button" onClick={() => void copy()}>{copied ? "Đã copy JSON" : "Copy cấu hình JSON"}</button>
            </div>
            <details className={styles.dataPanel}><summary>Dữ liệu cấu hình hiện tại</summary><pre>{exportDraft()}</pre></details>
            <details className={styles.technicalNote}>
              <summary>Giới hạn hiện tại của bản demo</summary>
              <p>Đầu thật Claude V2: hoa văn thay iris trên cùng bề mặt mắt; chớp mắt định kỳ là prototype, chưa phải blink rig hoàn chỉnh. GLB được cache trong trình duyệt (Safari có thể xóa). Có 6 mesh lông mi 3D. Các dáng mắt vui, buồn, giận… đang là biến dạng hình học vùng mắt trong viewer, chưa phải topology/morph targets sản xuất. Lớp màng mí lỗi của asset gốc chưa được sửa. Lông mi có sẵn trong texture HeadBase vẫn còn khi chọn None. Không thay đổi Character Catalog hoặc gameplay.</p>
            </details>
          </section>
        </div>
      </div>
    </main>
  );
}
