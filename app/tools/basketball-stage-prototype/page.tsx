"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type CameraMode = "front" | "angle" | "wide";
type CourtBuild = { root: THREE.Group; markers: THREE.Group };

function makeCanvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D texture canvas unavailable");
  draw(ctx, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function brickTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#c8a58e";
    ctx.fillRect(0, 0, w, h);
    const bw = 110;
    const bh = 41;
    for (let row = 0; row < Math.ceil(h / bh); row += 1) {
      const shift = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < w + bw; x += bw) {
        const px = x + shift + 3;
        const py = row * bh + 3;
        const seed = Math.abs(Math.sin((row + 11) * 91.1 + x * 0.073));
        const r = Math.round(148 + seed * 40);
        const g = Math.round(62 + seed * 42);
        const b = Math.round(44 + seed * 30);
        ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
        ctx.fillRect(px, py, bw - 5, bh - 5);
        ctx.fillStyle = "rgba(245,220,198,0.13)";
        ctx.fillRect(px + 5, py + 5, bw - 15, 2);
        ctx.fillStyle = "rgba(58,31,31,0.12)";
        ctx.fillRect(px + 3, py + bh - 11, bw - 11, 3);
        if (seed > 0.84) {
          ctx.fillStyle = "rgba(242,221,196,0.34)";
          ctx.fillRect(px + 7, py + 6, 24 + seed * 27, 10);
        }
      }
    }
    for (let i = 0; i < 330; i += 1) {
      const px = (Math.sin(i * 5.82) * 0.5 + 0.5) * w;
      const py = (Math.cos(i * 13.4) * 0.5 + 0.5) * h;
      ctx.fillStyle = i % 2 ? "rgba(40,27,20,0.13)" : "rgba(255,239,215,0.18)";
      ctx.fillRect(px, py, (i % 8) + 2, (i % 4) + 2);
    }
  }, 1024, 512);
}

function graffitiTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const inks = ["#8c30f9", "#f13ea7", "#24cff6", "#ff953c", "#c4a2ff", "#1c1435"];
    for (let i = 0; i < 68; i += 1) {
      const x = ((i * 137.8) % w);
      const y = ((i * 71.7) % h);
      ctx.beginPath();
      ctx.ellipse(x, y, 20 + (i % 9) * 16, 9 + (i % 6) * 11, i * 0.19, 0, Math.PI * 2);
      ctx.fillStyle = inks[i % inks.length] + "99";
      ctx.fill();
    }
    ctx.save();
    ctx.translate(w * 0.5, h * 0.61);
    ctx.rotate(-0.045);
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.font = "italic 900 198px Impact, Arial Black, sans-serif";
    ctx.strokeStyle = "#171125";
    ctx.lineWidth = 35;
    ctx.strokeText("STREET DANCE", 0, 0, w * 0.89);
    ctx.strokeStyle = "#fbeef9";
    ctx.lineWidth = 15;
    ctx.strokeText("STREET DANCE", 0, 0, w * 0.89);
    const gradient = ctx.createLinearGradient(-480, -90, 420, 90);
    gradient.addColorStop(0, "#ad83ff");
    gradient.addColorStop(0.45, "#e5c5ff");
    gradient.addColorStop(0.7, "#58dbff");
    gradient.addColorStop(1, "#fe77b5");
    ctx.fillStyle = gradient;
    ctx.fillText("STREET DANCE", 0, 0, w * 0.89);
    ctx.restore();
    for (let i = 0; i < 35; i += 1) {
      const x = (i * 223) % w;
      const y = 35 + ((i * 127) % (h - 65));
      ctx.strokeStyle = inks[(i + 1) % inks.length];
      ctx.lineWidth = 3 + (i % 4) * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 21 + (i % 8) * 10, y - 21);
      ctx.lineTo(x + 8, y + 20);
      ctx.stroke();
    }
  }, 2048, 512);
}

function buildCourt(): CourtBuild {
  const root = new THREE.Group();
  root.name = "BasketballStageIsolatedPrototype";
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  const material = (color: number, roughness = 0.85) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness }));
    return materials.get(color)!;
  };
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, color: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    mesh.name = name;
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };
  const beam = (name: string, a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number) => {
    const diff = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, diff.length(), 6), material(color));
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize());
    mesh.name = name;
    root.add(mesh);
    return mesh;
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(31, 31), material(0x344d6c));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.07, 0);
  floor.name = "FlatCourtFloor";
  root.add(floor);
  box("TerracottaKey", 0, -0.021, -2.9, 9.6, 0.035, 13.1, 0xc85c37);
  box("PaintedBackKey", 0, -0.019, -8.9, 9.6, 0.032, 1.1, 0xb74f33);
  const chalk = 0xf8e5b0;
  const stripe = (x: number, z: number, width: number, depth: number) => box("CourtMark", x, 0.015, z, width, 0.015, depth, chalk);
  stripe(-4.8, -2.9, 0.11, 13.1);
  stripe(4.8, -2.9, 0.11, 13.1);
  stripe(0, -9.35, 9.7, 0.12);
  stripe(0, 3.57, 9.6, 0.1);
  const arc = (name: string, x: number, z: number, radius: number, start: number, angle: number, thickness = 0.064) => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 100; i += 1) {
      const a = start + angle * i / 100;
      points.push(v(x + Math.cos(a) * radius, 0.045, z + Math.sin(a) * radius));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, thickness, 4, false), material(chalk));
    mesh.name = name;
    root.add(mesh);
  };
  arc("CenterDanceCircle", 0, 3.6, 4.78, 0, Math.PI, 0.078);
  arc("FreeThrowRing", 0, 3.57, 4.78, Math.PI, Math.PI, 0.078);
  arc("ThreePointArc", 0, -8.0, 11.8, 0.20, Math.PI - 0.4, 0.066);
  stripe(-12.9, 6.1, 0.1, 23);
  stripe(12.9, 6.1, 0.1, 23);
  // Building faces are real extruded volumes, not a skybox image.
  const brick = brickTexture();
  const brickFace = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.99 });
  const building = new THREE.Mesh(new THREE.BoxGeometry(29, 14, 3.1), brickFace);
  building.name = "RedBrickApartmentBuilding";
  building.position.set(0, 9.9, -13.9);
  root.add(building);
  box("LeftAlleyBlock", -16.8, 7.8, -13.9, 6.4, 15.5, 7, 0xbaa68c);
  box("RightAlleyBlock", 16.8, 8.8, -13.9, 6.4, 17.5, 7, 0xc77b62);
  box("RearWallConcrete", 0, 2.25, -10.55, 30, 4.65, 0.7, 0xa98a75);
  const graffiti = new THREE.Mesh(
    new THREE.PlaneGeometry(29.7, 3.8),
    new THREE.MeshBasicMaterial({ map: graffitiTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  graffiti.position.set(0, 2.0, -10.178);
  graffiti.name = "GraffitiMuralTextureOnWall";
  root.add(graffiti);
  box("WallCap", 0, 4.63, -10.55, 30.6, 0.23, 0.93, 0xd5c5ab);
  for (let y = 6.3; y <= 12.0; y += 3.2) {
    for (const x of [-10.8, -6.4, -2.0, 2.4, 11.9]) {
      box("WindowFrame", x, y, -12.30, 1.65, 2.12, 0.22, 0xd9c4ac);
      box("WindowGlass", x, y, -12.15, 1.29, 1.74, 0.045, 0x1d344d);
      box("WindowCrossVertical", x, y, -12.10, 0.075, 1.74, 0.06, 0xc7baaa);
      box("WindowCrossHorizontal", x, y, -12.08, 1.35, 0.065, 0.06, 0xb6a99a);
      box("WindowSill", x, y - 1.1, -12.15, 1.97, 0.14, 0.33, 0xe1d8c3);
    }
  }
  // Fire escape: platforms, stairs, rails, and vertical supports.
  const iron = 0x243343;
  const makePlatform = (y: number) => {
    box("FireEscapePlatform", 8.2, y, -11.2, 8, 0.16, 1.8, iron);
    for (let x = 4.2; x <= 12.2; x += 0.65) {
      beam("FireEscapeBaluster", v(x, y, -10.28), v(x, y + 0.93, -10.28), 0.032, iron);
    }
    beam("FireEscapeTopRail", v(4.2, y + 0.93, -10.28), v(12.2, y + 0.93, -10.28), 0.07, iron);
    for (const x of [4.2, 12.2]) {
      beam("FireEscapePost", v(x, y, -12.0), v(x, y + 0.93, -12.0), 0.065, iron);
    }
  };
  makePlatform(7.0);
  makePlatform(10.45);
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    const x = 10.9 - t * 4.9;
    const y = 7.09 + t * 3.36;
    box("FireEscapeStairTread", x, y, -10.97, 0.37, 0.09, 1.6, iron);
  }
  beam("LeftStairStringer", v(10.9, 7.1, -10.18), v(6.0, 10.45, -10.18), 0.08, iron);
  beam("RightStairStringer", v(10.9, 7.1, -11.72), v(6.0, 10.45, -11.72), 0.08, iron);
  beam("StairHandrail", v(11.2, 8.1, -10.13), v(6.2, 11.38, -10.13), 0.065, iron);
  for (let i = 0; i < 8; i += 1) {
    const t = i / 7;
    beam("DiagonalStairBaluster", v(11.0 - t * 4.7, 7.15 + t * 3.18, -10.13), v(11.0 - t * 4.7, 8.0 + t * 3.18, -10.13), 0.03, iron);
  }
  // Basket board faces the playable court.
  beam("BasketPole", v(0, 0.01, -9.3), v(0, 5.5, -9.3), 0.14, 0x657682);
  beam("BasketArm", v(0, 5.35, -9.3), v(0, 5.15, -8.52), 0.12, 0x657682);
  box("BasketBackboardTrim", 0, 4.95, -8.48, 3.12, 1.86, 0.14, 0xf17a30);
  box("BasketBackboardWhite", 0, 4.95, -8.38, 2.95, 1.69, 0.045, 0xf8f2e6);
  box("BasketBackboardBoxTop", 0, 4.84, -8.34, 0.81, 0.055, 0.055, 0xee7d35);
  box("BasketBackboardBoxLeft", -0.395, 4.60, -8.34, 0.055, 0.54, 0.055, 0xee7d35);
  box("BasketBackboardBoxRight", 0.395, 4.60, -8.34, 0.055, 0.54, 0.055, 0xee7d35);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.05, 7, 28), material(0xea6c22));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 4.13, -7.78);
  rim.name = "BasketballRim";
  root.add(rim);
  for (let i = 0; i < 12; i += 1) {
    const a = Math.PI * 2 * i / 12;
    const b = Math.PI * 2 * (i + 1) / 12;
    beam("HoopNetThread", v(Math.cos(a) * 0.46, 4.11, -7.78 + Math.sin(a) * 0.46), v(Math.cos(b) * 0.29, 3.46, -7.78 + Math.sin(b) * 0.29), 0.014, 0xf6efe2);
  }
  const markers = new THREE.Group();
  markers.name = "FiveDancerPositionGuide";
  for (let i = 0; i < 5; i += 1) {
    const x = (i - 2) * 2.05;
    const z = 2.15 + Math.abs(i - 2) * 0.21;
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.50, 48),
      new THREE.MeshBasicMaterial({ color: i === 2 ? 0xffd17b : 0x8cf3fa, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.06, z);
    markers.add(disc);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(x, 0.066, z);
    markers.add(dot);
  }
  markers.visible = false;
  root.add(markers);
  return { root, markers };
}

function disposeScene(root: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    const entries = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of entries) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  textures.forEach(item => item.dispose());
  geometries.forEach(item => item.dispose());
  materials.forEach(item => item.dispose());
}

const poses: Record<CameraMode, { eye: [number, number, number]; look: [number, number, number]; fov: number }> = {
  front: { eye: [0, 8.8, 23], look: [0, 3.1, -5], fov: 47 },
  angle: { eye: [14, 9, 18], look: [0, 3.2, -5], fov: 48 },
  wide: { eye: [0, 13.6, 28], look: [0, 3.5, -4], fov: 55 },
};

export default function BasketballStagePrototypePage() {
  const host = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const markersRef = useRef<THREE.Group | null>(null);
  const [mode, setMode] = useState<CameraMode>("front");
  const [showMarkers, setShowMarkers] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setError("Không khởi tạo được WebGL trên thiết bị này.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    target.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x98cdf0);
    scene.fog = new THREE.Fog(0x98cdf0, 39, 95);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7c7c9a, 2.5));
    const sun = new THREE.DirectionalLight(0xffedd8, 2.3);
    sun.position.set(-10, 19, 15);
    scene.add(sun);
    let built: CourtBuild;
    try {
      built = buildCourt();
    } catch {
      setError("Không thể tạo vật liệu 3D cho sân bóng rổ.");
      renderer.dispose();
      renderer.domElement.remove();
      return;
    }
    scene.add(built.root);
    markersRef.current = built.markers;
    built.markers.visible = showMarkers;
    const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 130);
    cameraRef.current = camera;
    camera.position.set(...poses.front.eye);
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.target.set(...poses.front.look);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 10;
    controls.maxDistance = 44;
    controls.minPolarAngle = 0.33;
    controls.maxPolarAngle = 1.52;
    controls.update();
    const resize = () => {
      const w = Math.max(target.clientWidth, 1);
      const h = Math.max(target.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    resize();
    let raf = 0;
    const frame = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(frame);
    };
    frame();
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      controlsRef.current = null;
      cameraRef.current = null;
      markersRef.current = null;
      disposeScene(built.root);
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Deliberately initialize the isolated renderer only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (markersRef.current) markersRef.current.visible = showMarkers;
  }, [showMarkers]);
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const pose = poses[mode];
    camera.position.set(...pose.eye);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    controls.target.set(...pose.look);
    controls.update();
  }, [mode]);

  return (
    <main data-testid="basketball-stage-prototype" style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#93c9e9", color: "white", fontFamily: "system-ui,sans-serif" }}>
      <div ref={host} data-testid="basketball-stage-canvas" style={{ position: "absolute", inset: 0 }} />
      <header style={{ position: "absolute", top: "max(18px, env(safe-area-inset-top))", left: 15, right: 15, display: "flex", justifyContent: "space-between", gap: 10, pointerEvents: "none" }}>
        <div style={{ padding: "10px 13px", borderRadius: 13, background: "rgba(12,23,39,.78)", backdropFilter: "blur(12px)" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#99f4f7", fontWeight: 800 }}>AUDITION / ENVIRONMENT LAB</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🏀 Basketball Street Court</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>Three.js 3D prototype · Chưa tích hợp gameplay</div>
        </div>
      </header>
      {error && <div role="alert" style={{ position: "absolute", top: "45%", left: 20, right: 20, padding: 15, borderRadius: 12, background: "#621e2a" }}>{error}</div>}
      <footer style={{ position: "absolute", bottom: "max(20px, env(safe-area-inset-bottom))", left: 12, right: 12, display: "grid", gap: 8, pointerEvents: "none" }}>
        <div style={{ textAlign: "center", fontSize: 11, textShadow: "0 2px 5px #172738" }}>Vuốt để xoay camera · Chụm hai ngón để zoom</div>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 6, pointerEvents: "auto" }}>
          {(["front", "angle", "wide"] as CameraMode[]).map(option => (
            <button key={option} onClick={() => setMode(option)} aria-pressed={mode === option} style={{ border: "1px solid rgba(255,255,255,.38)", borderRadius: 22, background: mode === option ? "#f4ddad" : "rgba(16,31,49,.86)", color: mode === option ? "#172b3b" : "#fff", padding: "10px 13px", fontWeight: 700, fontSize: 12 }}>
              {option === "front" ? "Chính diện" : option === "angle" ? "Góc nghiêng" : "Toàn cảnh"}
            </button>
          ))}
          <button onClick={() => setShowMarkers(value => !value)} aria-pressed={showMarkers} style={{ border: "1px solid rgba(255,255,255,.38)", borderRadius: 22, background: showMarkers ? "#91edee" : "rgba(16,31,49,.86)", color: showMarkers ? "#172b3b" : "#fff", padding: "10px 13px", fontWeight: 700, fontSize: 12 }}>
            {showMarkers ? "Ẩn 5 vị trí" : "Hiện 5 vị trí"}
          </button>
        </div>
      </footer>
    </main>
  );
}
