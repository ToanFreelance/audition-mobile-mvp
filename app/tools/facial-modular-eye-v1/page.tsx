"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import styles from "./FacialEyeLab.module.css";

type IrisStyle = "natural" | "radiant" | "velvet" | "crystal";
type LashStyle = "natural" | "doll" | "dramatic" | "none";
type CameraView = "front" | "left" | "right";

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

type EyeScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  face: THREE.Group;
  eyes: THREE.Group[];
  irises: THREE.Mesh[];
  irisMaterial: THREE.MeshBasicMaterial;
  lashes: Record<LashStyle, THREE.Group>[];
  render: () => void;
  resize: () => void;
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

function tint(color: string, factor: number): string {
  const channels = [1, 3, 5].map(index => Math.min(255, Math.max(0, Math.round(parseInt(color.slice(index, index + 2), 16) * factor))));
  return "rgb(" + channels.join(",") + ")";
}

function buildIris(draft: EyeDraft): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D texture canvas unavailable");
  const center = 256;
  const radius = 232;
  const radial = ctx.createRadialGradient(center, center, 24, center, center, radius);
  radial.addColorStop(0, tint(draft.irisColor, 0.37));
  radial.addColorStop(0.35, tint(draft.irisColor, draft.irisStyleId === "radiant" ? 1.25 : 0.98));
  radial.addColorStop(0.76, tint(draft.irisColor, draft.irisStyleId === "velvet" ? 0.74 : 1.32));
  radial.addColorStop(0.94, tint(draft.irisColor, 0.73));
  radial.addColorStop(1, tint(draft.irisColor, 0.24));
  ctx.fillStyle = radial;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius - 7, 0, Math.PI * 2);
  ctx.clip();
  const count = draft.irisStyleId === "crystal" ? 240 : draft.irisStyleId === "radiant" ? 200 : 140;
  const seed = draft.irisStyleId === "velvet" ? 1.65 : 2.15;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const jitter = Math.sin(i * 19.7) * 0.09;
    const inner = 62 + 16 * Math.sin(i * seed);
    const outer = 188 + 35 * Math.abs(Math.sin(i * 9.73));
    const bright = i % 3 === 0;
    ctx.strokeStyle = bright ? "rgba(250,226,176,0.24)" : "rgba(32,14,25,0.30)";
    ctx.lineWidth = draft.irisStyleId === "crystal" ? 1.1 : 2.1;
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
    ctx.quadraticCurveTo(
      center + Math.cos(angle + jitter) * ((inner + outer) / 2),
      center + Math.sin(angle + jitter) * ((inner + outer) / 2),
      center + Math.cos(angle) * outer,
      center + Math.sin(angle) * outer
    );
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(20,13,22,0.72)";
  ctx.lineWidth = 13;
  ctx.beginPath(); ctx.arc(center, center, radius - 7, 0, Math.PI * 2); ctx.stroke();

  const pupilRadius = 65 + (draft.pupilScale - 0.38) * 115;
  const pupil = ctx.createRadialGradient(center, center, 3, center, center, pupilRadius + 20);
  pupil.addColorStop(0, "#040409"); pupil.addColorStop(0.77, "#090711");
  pupil.addColorStop(0.9, "rgba(15,9,16,0.95)");
  pupil.addColorStop(1, "rgba(15,9,16,0)");
  ctx.fillStyle = pupil;
  ctx.beginPath(); ctx.arc(center, center, pupilRadius + 20, 0, Math.PI * 2); ctx.fill();
  // Highlights remain controlled by the eye module, never by an extra iris-colored shell.
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath(); ctx.ellipse(190, 177, 32, 17, -0.33, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.57)";
  ctx.beginPath(); ctx.ellipse(296, 319, 10, 6, 0.5, 0, Math.PI * 2); ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function curvedLine(points: THREE.Vector3[], material: THREE.Material, radius: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, radius, 5, false), material);
}

function createLashes(style: Exclude<LashStyle, "none">): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x24151d, roughness: 0.82 });
  const count = style === "dramatic" ? 17 : style === "doll" ? 13 : 10;
  const length = style === "dramatic" ? 0.145 : style === "doll" ? 0.11 : 0.073;
  for (let n = 0; n < count; n += 1) {
    const t = n / (count - 1);
    const x = -0.275 + t * 0.55;
    const y = 0.02 + 0.175 * Math.sin(t * Math.PI);
    const lift = length * (0.68 + 0.6 * Math.sin(t * Math.PI));
    group.add(curvedLine([
      new THREE.Vector3(x, y, 0.81),
      new THREE.Vector3(x + (t - 0.5) * 0.03, y + lift * 0.57, 0.839),
      new THREE.Vector3(x + (t - 0.5) * 0.077, y + lift, 0.824),
    ], material, style === "dramatic" ? 0.006 : 0.004));
  }
  return group;
}

function createEye(irisMaterial: THREE.MeshBasicMaterial) {
  const eye = new THREE.Group();
  const sclera = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xf6edf0, roughness: 0.21, clearcoat: 0.65 })
  );
  sclera.scale.set(0.31, 0.205, 0.14);
  sclera.position.z = 0.685;
  eye.add(sclera);

  const iris = new THREE.Mesh(new THREE.CircleGeometry(1, 96), irisMaterial);
  iris.position.set(0, -0.014, 0.827);
  iris.scale.setScalar(0.15);
  eye.add(iris);

  const lidMaterial = new THREE.MeshStandardMaterial({ color: 0x8f545b, roughness: 0.78 });
  const eyeliner = new THREE.MeshStandardMaterial({ color: 0x372127, roughness: 0.75 });
  const upper = [-0.30, -0.21, -0.10, 0, 0.10, 0.21, 0.30].map(x =>
    new THREE.Vector3(x, 0.025 + 0.158 * Math.sqrt(Math.max(0, 1 - x * x / (0.32 * 0.32))), 0.813)
  );
  const lower = [-0.30, -0.21, -0.10, 0, 0.10, 0.21, 0.30].map(x =>
    new THREE.Vector3(x, -0.035 - 0.155 * Math.sqrt(Math.max(0, 1 - x * x / (0.32 * 0.32))), 0.81)
  );
  eye.add(curvedLine(upper, eyeliner, 0.015));
  eye.add(curvedLine(lower, lidMaterial, 0.012));

  const lashStyles: Record<LashStyle, THREE.Group> = {
    natural: createLashes("natural"),
    doll: createLashes("doll"),
    dramatic: createLashes("dramatic"),
    none: new THREE.Group(),
  };
  for (const group of Object.values(lashStyles)) eye.add(group);
  return { eye, iris, lashStyles };
}

function createScene(host: HTMLDivElement, draft: EyeDraft): EyeScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.className = styles.canvas;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151224);
  const camera = new THREE.OrthographicCamera(-1.45, 1.45, 1.45, -1.45, 0.1, 30);
  camera.position.set(0, 0, 7);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6d507b, 2.4));
  const key = new THREE.DirectionalLight(0xffe8de, 2.0);
  key.position.set(2, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0x7f9fff, 0.8);
  fill.position.set(-4, 1, 4); scene.add(fill);

  const face = new THREE.Group();
  scene.add(face);
  const skin = new THREE.MeshStandardMaterial({ color: 0xe2a8a8, roughness: 0.83 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), skin);
  head.scale.set(0.96, 1.23, 0.64);
  head.position.y = -0.025;
  face.add(head);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), skin);
  nose.scale.set(0.125, 0.19, 0.17);
  nose.position.set(0, -0.34, 0.655);
  face.add(nose);
  const lip = curvedLine([
    new THREE.Vector3(-0.22, -0.67, 0.55),
    new THREE.Vector3(-0.09, -0.697, 0.594),
    new THREE.Vector3(0, -0.685, 0.61),
    new THREE.Vector3(0.09, -0.697, 0.594),
    new THREE.Vector3(0.22, -0.67, 0.55),
  ], new THREE.MeshStandardMaterial({ color: 0xa75d70, roughness: 0.59 }), 0.021);
  face.add(lip);

  const irisMaterial = new THREE.MeshBasicMaterial({ map: buildIris(draft), transparent: true, depthWrite: false });
  const eyes: THREE.Group[] = [];
  const irises: THREE.Mesh[] = [];
  const lashes: Record<LashStyle, THREE.Group>[] = [];
  for (const sign of [-1, 1]) {
    const item = createEye(irisMaterial);
    item.eye.position.set(sign * 0.39, 0.18, 0.04);
    face.add(item.eye);
    eyes.push(item.eye);
    irises.push(item.iris);
    lashes.push(item.lashStyles);
    const brow = curvedLine([
      new THREE.Vector3(sign * 0.13, 0.53, 0.61),
      new THREE.Vector3(sign * 0.32, 0.575, 0.58),
      new THREE.Vector3(sign * 0.55, 0.53, 0.53),
    ], new THREE.MeshStandardMaterial({ color: 0x704447, roughness: 1 }), 0.021);
    face.add(brow);
  }

  const render = () => renderer.render(scene, camera);
  const resize = () => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    const aspect = width / height;
    const half = 1.33;
    camera.left = -half * aspect; camera.right = half * aspect;
    camera.top = half; camera.bottom = -half;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  };
  return { scene, renderer, camera, face, eyes, irises, irisMaterial, lashes, render, resize };
}

function EyePreview({ draft, view }: { draft: EyeDraft; view: CameraView }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EyeScene | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let scene: EyeScene | null = null;
    let observer: ResizeObserver | null = null;
    try {
      scene = createScene(host, DEFAULT);
      sceneRef.current = scene;
      observer = new ResizeObserver(() => scene?.resize());
      observer.observe(host);
      scene.resize();
      setStatus("ready");
    } catch {
      if (scene) scene.renderer.dispose();
      setStatus("unavailable");
    }

    const current = scene;
    return () => {
      observer?.disconnect();
      sceneRef.current = null;
      if (!current) return;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      current.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const mat of mats) materials.add(mat);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) {
        if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
        material.dispose();
      }
      current.renderer.dispose();
      if (current.renderer.domElement.parentElement === host) host.removeChild(current.renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const texture = buildIris(draft);
    const previous = scene.irisMaterial.map;
    scene.irisMaterial.map = texture;
    scene.irisMaterial.needsUpdate = true;
    previous?.dispose();
    scene.render();
  }, [draft.irisColor, draft.irisStyleId, draft.pupilScale]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.face.rotation.y = view === "front" ? 0 : view === "left" ? -0.36 : 0.36;
    scene.eyes.forEach((eye, index) => {
      eye.position.x = (index === 0 ? -1 : 1) * 0.39 * draft.eyeSpacing;
      eye.scale.set(draft.eyeScale * draft.eyeWidth, draft.eyeScale * draft.eyeHeight, draft.eyeScale);
      scene.irises[index].scale.setScalar(0.15 * draft.irisScale);
      for (const key of Object.keys(scene.lashes[index]) as LashStyle[]) {
        scene.lashes[index][key].visible = key === draft.lashStyleId;
      }
    });
    scene.render();
  }, [draft.eyeScale, draft.eyeWidth, draft.eyeHeight, draft.eyeSpacing, draft.irisScale, draft.lashStyleId, view]);

  return (
    <div className={styles.viewport} ref={hostRef} data-testid="eye-preview" data-preview-status={status}>
      {status === "loading" && <span className={styles.previewNote}>Khởi tạo 3D…</span>}
      {status === "unavailable" && (
        <div className={styles.fallback}>
          <strong>WebGL không khả dụng</strong>
          <span>Thiết bị này không thể render 3D. Thử trên iPhone Safari hoặc trình duyệt có WebGL.</span>
        </div>
      )}
      <span className={styles.viewportCaption}>PROCEDURAL EYE MODULE · NOT THE HY3D HEAD ASSET</span>
    </div>
  );
}

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
            <p>Thử kiểu iris, màu mắt, hình dáng và lông mi trên một eye module 3D độc lập.</p>
          </div>
          <div className={styles.experimentBadge}>ISOLATED EXPERIMENT</div>
        </header>

        <div className={styles.layout}>
          <section className={styles.previewPanel} aria-label="3D eye module preview">
            <div className={styles.previewTop}>
              <strong>Live 3D preview</strong><span>Chưa ghi vào Character Catalog</span>
            </div>
            <EyePreview draft={draft} view={view} />
            <div className={styles.viewControl} role="group" aria-label="Góc nhìn">
              {(["front", "left", "right"] as const).map(item => (
                <button type="button" aria-pressed={view === item} className={view === item ? styles.active : ""}
                  key={item} onClick={() => setView(item)}>
                  {item === "front" ? "Chính diện" : item === "left" ? "3/4 trái" : "3/4 phải"}
                </button>
              ))}
            </div>
            <p className={styles.disclaimer}>Đây là prototype module tạo hình bằng Three.js. Chưa phải GLB HY3D đã được tái cấu trúc hoặc morph thực tế; không thay đổi character runtime.</p>
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

            <div className={styles.sectionHeading}><span>04</span><h2>Lông mi · Eye Module</h2></div>
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
