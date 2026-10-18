"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { makeOldBrick, makeRetainingWall, makeGraffitiWall, makeAsphalt, makePaint, makeBackboardPatina, installAmbientIvy } from "./stage-look";

type CameraMode = "front" | "angle" | "wide";
type CourtBuild = { root: THREE.Group; markers: THREE.Group; animate: (seconds: number, enabled: boolean) => void };

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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(31, 31), new THREE.MeshStandardMaterial({ map: makeAsphalt(), roughness: 0.99 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.07, 0);
  floor.name = "FlatCourtFloor";
  root.add(floor);
  // Reference-grounded FIBA measurements: restricted area 4.90 m wide,
  // free-throw circle 3.60 m across, and 5 cm marking width.
  // Keep the existing decorative orange apron independent of regulated lines.
  const laneWidthUnits = 9.6;
  const sceneUnitsPerMeter = laneWidthUnits / 4.9;
  const freeThrowRadius = 1.8 * sceneUnitsPerMeter;
  const freeThrowDiameter = 3.6 * sceneUnitsPerMeter;
  const courtLineRadius = 0.025 * sceneUnitsPerMeter;
  const freeThrowZ = 3.57;
  const weatheredOrange = new THREE.MeshStandardMaterial({ map: makePaint(), roughness: 0.98 });
  box("TerracottaKey", 0, -0.021, -2.9, 9.6, 0.035, 13.1, 0xc85c37).material = weatheredOrange;
  box("PaintedBackKey", 0, -0.019, -8.9, 9.6, 0.032, 1.1, 0xb74f33).material = weatheredOrange;
  // Single rounded paint key, following the original concept's half-court silhouette.
  const fanPositions: number[] = [];
  const fanUVs: number[] = [];
  const fanIndices: number[] = [];
  const addFanVertex = (x: number, z: number) => {
    fanPositions.push(x, -0.002, z);
    fanUVs.push(0.5 + x / 9.6, 0.5 + (z - 3.57) / 9.6);
  };
  addFanVertex(0, 3.57);
  for (let i = 0; i <= 72; i += 1) {
    const angle = Math.PI * i / 72;
    addFanVertex(Math.cos(angle) * 4.78, 3.57 + Math.sin(angle) * 4.78);
  }
  for (let i = 1; i <= 72; i += 1) fanIndices.push(0, i + 1, i);
  const fanGeometry = new THREE.BufferGeometry();
  fanGeometry.setAttribute("position", new THREE.Float32BufferAttribute(fanPositions, 3));
  fanGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(fanUVs, 2));
  fanGeometry.setIndex(fanIndices);
  fanGeometry.computeVertexNormals();
  const roundedPaint = new THREE.Mesh(fanGeometry, weatheredOrange);
  roundedPaint.name = "ReferenceRoundedOrangeKey";
  root.add(roundedPaint);
  const chalk = 0xe8d4a8;
  const stripe = (x: number, z: number, width: number, depth: number) => box("CourtMark", x, 0.015, z, width, 0.015, depth, chalk);
  stripe(-4.8, -2.9, 0.11, 13.1);
  stripe(4.8, -2.9, 0.11, 13.1);
  stripe(0, -9.35, 9.7, 0.12);
  // Actual FIBA free-throw line spans 3.60 m, not the full 4.90 m lane.
  stripe(0, freeThrowZ, freeThrowDiameter, courtLineRadius * 2);
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
  // Outline of the orange graphic apron is decorative, not a second
  // free-throw circle. The actual free-throw circle is the two matched
  // 1.80 m radius halves centred at the midpoint of the 3.60 m line.
  arc("DecorativeOrangeApronEdge", 0, freeThrowZ, 4.78, 0, Math.PI, 0.078);
  arc("RegulationFreeThrowSolidSemicircle", 0, freeThrowZ,
    freeThrowRadius, 0, Math.PI, courtLineRadius);
  // Inside the restricted area FIBA illustrates a dashed inner half.
  for (let dash = 0; dash < 14; dash++) {
    const dashLength = (Math.PI / 14) * 0.58;
    arc("RegulationFreeThrowDashedSemicircle", 0, freeThrowZ,
      freeThrowRadius, Math.PI + dash * (Math.PI / 14),
      dashLength, courtLineRadius);
  }
  arc("DistantOuterArc", 0, -8.0, 17.5, 0.14, Math.PI - 0.28, 0.065);
  for (const side of [-1, 1]) {
    for (let tick = 0; tick < 5; tick++) {
      stripe(side * 5.12, -8.3 + tick * 1.55, 0.76, 0.12);
    }
  }
  stripe(-12.9, 6.1, 0.1, 23);
  stripe(12.9, 6.1, 0.1, 23);
  // Building faces are real extruded volumes, not a skybox image.
  const brick = makeOldBrick();
  const brickFace = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.97 });
  const stoneWall = new THREE.MeshStandardMaterial({ map: makeRetainingWall(), roughness: 0.99 });
  const building = new THREE.Mesh(new THREE.BoxGeometry(29, 14, 3.1), brickFace);
  building.name = "RedBrickApartmentBuilding";
  building.position.set(0, 9.9, -13.9);
  root.add(building);
  box("LeftAlleyBlock", -16.8, 7.8, -13.9, 6.4, 15.5, 7, 0xbaa68c);
  box("RightAlleyBlock", 16.8, 8.8, -13.9, 6.4, 17.5, 7, 0xc77b62);
  box("RearWallConcrete", 0, 2.25, -10.55, 30, 4.65, 0.7, 0xa98a75).material = stoneWall;
  const graffiti = new THREE.Mesh(
    new THREE.PlaneGeometry(29.7, 3.94),
    new THREE.MeshBasicMaterial({
      map: makeGraffitiWall(), transparent: true, opacity: 0.99,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    }),
  );
  graffiti.position.set(0, 2.26, -10.185);
  graffiti.name = "GraffitiMuralTextureOnWall";
  root.add(graffiti);
  box("WallCap", 0, 4.63, -10.55, 30.6, 0.23, 0.93, 0xd5c5ab);
  for (let y = 6.3; y <= 12.0; y += 3.2) {
    for (const x of [-10.0, -5.5, 8.0]) {
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
  // Patinated metal softens the prototype fire escape material.
  const metal = new THREE.MeshStandardMaterial({ color: 0x35485c, metalness: 0.58, roughness: 0.58 });
  const rawIron = material(iron);
  root.traverse(node => { if (node instanceof THREE.Mesh && node.material === rawIron) node.material = metal; });
  // Basket board faces the playable court.
  beam("BasketPole", v(0, 0.01, -9.3), v(0, 5.5, -9.3), 0.14, 0x657682);
  beam("BasketArm", v(0, 5.35, -9.3), v(0, 5.15, -8.52), 0.12, 0x657682);
  // The previous white rectangle disappeared into the beige wall on iPhone.
  // A back-facing solid slab, broad orange perimeter and curved fiberglass face
  // match the silhouette and contrast of the approved basketball concept.
  const boardOutline = new THREE.Shape();
  boardOutline.moveTo(-1.52, -0.93);
  boardOutline.lineTo(-1.88, -0.62);
  boardOutline.quadraticCurveTo(-1.95, -0.55, -1.95, -0.40);
  boardOutline.lineTo(-1.95, 0.27);
  boardOutline.quadraticCurveTo(-1.92, 0.58, -1.67, 0.75);
  boardOutline.quadraticCurveTo(0, 1.57, 1.67, 0.75);
  boardOutline.quadraticCurveTo(1.92, 0.58, 1.95, 0.27);
  boardOutline.lineTo(1.95, -0.40);
  boardOutline.quadraticCurveTo(1.95, -0.55, 1.88, -0.62);
  boardOutline.lineTo(1.52, -0.93);
  boardOutline.closePath();
  const boardSurface = new THREE.ShapeGeometry(boardOutline, 24);
  const boardEdge = new THREE.Mesh(boardSurface, new THREE.MeshBasicMaterial({
    color: 0xef7b32, toneMapped: false, side: THREE.DoubleSide,
  }));
  boardEdge.position.set(0, 4.98, -8.32);
  boardEdge.name = "BasketBackboardOrangeOutline";
  root.add(boardEdge);
  const boardFace = new THREE.Mesh(boardSurface, new THREE.MeshBasicMaterial({
    color: 0xf4efe5, toneMapped: false, side: THREE.DoubleSide,
  }));
  boardFace.position.set(0, 4.98, -8.309);
  boardFace.scale.set(0.955, 0.944, 1);
  boardFace.name = "BasketBackboardFiberglass";
  root.add(boardFace);
  // Match the patina geometry to the curved board rather than drawing dirt
  // outside the silhouette; original decal plane looked like a gray rectangle.
  const boardUvGeometry = boardSurface.clone();
  const p = boardUvGeometry.getAttribute("position");
  const uv = boardUvGeometry.getAttribute("uv");
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, (p.getX(i) + 1.96) / 3.92, (p.getY(i) + 0.95) / 2.55);
  }
  uv.needsUpdate = true;
  const patina = new THREE.Mesh(boardUvGeometry, new THREE.MeshBasicMaterial({
    map: makeBackboardPatina(), transparent: true, opacity: 0.31,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }));
  patina.position.set(0, 4.98, -8.301);
  patina.scale.copy(boardFace.scale);
  patina.name = "SubtleBackboardPatina";
  root.add(patina);
  const targetOrange = 0xee762e;
  box("BasketTargetTop", 0, 4.85, -8.275, 1.03, 0.065, 0.018, targetOrange);
  box("BasketTargetLeft", -0.50, 4.55, -8.275, 0.065, 0.63, 0.018, targetOrange);
  box("BasketTargetRight", 0.50, 4.55, -8.275, 0.065, 0.63, 0.018, targetOrange);
  box("BasketTargetBottom", 0, 4.245, -8.275, 1.03, 0.061, 0.018, targetOrange);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.05, 7, 28), material(0xea6c22));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 4.13, -7.78);
  rim.name = "BasketballRim";
  root.add(rim);
  const net = new THREE.Group();
  net.name = "AmbientHoopNetPivot";
  net.position.set(0, 4.11, -7.78);
  root.add(net);
  for (let i = 0; i < 12; i += 1) {
    const a = Math.PI * 2 * i / 12;
    const b = Math.PI * 2 * (i + 1) / 12;
    const thread = beam(
      "HoopNetThread",
      v(Math.cos(a) * 0.46, 0, Math.sin(a) * 0.46),
      v(Math.cos(b) * 0.29, -0.65, Math.sin(b) * 0.29),
      0.014, 0xe6e1d9,
    );
    root.remove(thread);
    net.add(thread);
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
  return { root, markers, animate: installAmbientIvy(root, net) };
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
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const ambientRef = useRef(true);
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
    renderer.toneMappingExposure = 1.13;
    target.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x91c7ed);
    scene.fog = new THREE.Fog(0x91c7ed, 42, 96);
    scene.add(new THREE.HemisphereLight(0xfff6eb, 0x7890b1, 1.42));
    const sun = new THREE.DirectionalLight(0xfff0df, 1.82);
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ambientRef.current = false;
      setAmbientEnabled(false);
    }
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
    const startTime = performance.now();
    const frame = (time: number) => {
      if (!document.hidden) {
        built.animate((time - startTime) / 1000, ambientRef.current);
        controls.update();
        renderer.render(scene, camera);
      }
      raf = window.requestAnimationFrame(frame);
    };
    frame(startTime);
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
  useEffect(() => { ambientRef.current = ambientEnabled; }, [ambientEnabled]);
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
          <button onClick={() => setAmbientEnabled(value => !value)} aria-pressed={ambientEnabled} style={{ border: "1px solid rgba(255,255,255,.38)", borderRadius: 22, background: ambientEnabled ? "#91edee" : "rgba(16,31,49,.86)", color: ambientEnabled ? "#172b3b" : "#fff", padding: "10px 13px", fontWeight: 700, fontSize: 12 }}>
            {ambientEnabled ? "Chuyển động: Bật" : "Chuyển động: Tắt"}
          </button>
        </div>
      </footer>
    </main>
  );
}
