"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./tryon.css";

const SAMPLE_ROOT = "https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/beta/";
const BASE_VITA = SAMPLE_ROOT + "Vita.vrm";

const VARIANT_A_STORE = "audition-vita-hair-v2";
const VARIANT_A_KEY = "approved-variant-a-v11";
const PHOTO_STORE_KEY = "audition-vita-hair-v2:photos";

// Browsers cannot fetch a private ChatGPT Library GLB as an unauthenticated URL.
// Preserve the genuine approved Variant A after the owner imports it once.
// No mesh is uploaded to the server.
function openAvatarDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(VARIANT_A_STORE, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("models")) req.result.createObjectStore("models");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function loadSavedVariantA(): Promise<ArrayBuffer | null> {
  const db = await openAvatarDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction("models", "readonly");
      const req = tx.objectStore("models").get(VARIANT_A_KEY);
      req.onsuccess = () => resolve(req.result instanceof ArrayBuffer ? req.result : null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); resolve(null); };
    } catch { db.close(); resolve(null); }
  });
}
async function saveVariantA(buffer: ArrayBuffer): Promise<boolean> {
  const db = await openAvatarDb();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const tx = db.transaction("models", "readwrite");
      tx.objectStore("models").put(buffer, VARIANT_A_KEY);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
      tx.onabort = () => { db.close(); resolve(false); };
    } catch { db.close(); resolve(false); }
  });
}
async function removeSavedVariantA(): Promise<void> {
  const db = await openAvatarDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction("models", "readwrite");
      tx.objectStore("models").delete(VARIANT_A_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    } catch { db.close(); resolve(); }
  });
}


type ReadyHair = { id: string; label: string; note: string; url?: string; source: string };
type Candidate = { label: string; kind: string; source: string; url: string };
type HairGroup = THREE.Group & { userData: { sourceName?: string } };
type Viewer = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  loader: GLTFLoader;
  root: THREE.Object3D | null;
  head: THREE.Object3D | null;
  baseHair: THREE.Object3D[];
  groups: Map<string, HairGroup>;
  animationId: number;
  disposeResize?: () => void;
};

const READY: ReadyHair[] = [
  { id: "original", label: "Tóc gốc Vita", note: "VRoid Vita CC0 · Mặc định", source: "Vita" },
  { id: "female-sample", label: "HairSample Female", note: "VRoid CC0 · Tóc nữ", source: "pixiv / VRoid", url: SAMPLE_ROOT + "HairSample_Female.vrm" },
  { id: "male-sample", label: "HairSample Male", note: "VRoid CC0 · Tóc nam", source: "pixiv / VRoid", url: SAMPLE_ROOT + "HairSample_Male.vrm" },
  { id: "vivi-bob", label: "Vivi · Anime Bob", note: "AvatarSample β2 · CC0", source: "pixiv / VRoid", url: SAMPLE_ROOT + "Vivi.vrm" },
  { id: "shibu-bob", label: "Shibu · Short Bob", note: "AvatarSample β1 · CC0", source: "pixiv / VRoid", url: SAMPLE_ROOT + "Sendagaya_Shibu.vrm" },
  { id: "victoria", label: "Victoria · Soft Blonde", note: "AvatarSample β4 · CC0", source: "pixiv / VRoid", url: SAMPLE_ROOT + "Victoria_Rubin.vrm" },
];

const CANDIDATES: Candidate[] = [
  { label: "Short Bob + Pigtails", kind: "Twintails", source: "BOOTH · FeliKitty", url: "https://booth.pm/en/items/3954400" },
  { label: "Annie Braid", kind: "Braid", source: "BOOTH · Reira", url: "https://booth.pm/en/items/4604559" },
  { label: "Rogue Short Layered", kind: "Layer", source: "BOOTH · nottanavery", url: "https://booth.pm/en/items/3000935" },
  { label: "Original Wolf Cut", kind: "Wolf cut", source: "BOOTH · maruko", url: "https://booth.pm/en/items/7543621" },
  { label: "Shuera Soft Pink", kind: "Anime bob", source: "BOOTH · Yuzuhako", url: "https://booth.pm/en/items/6815201" },
  { label: "Free VRoid Ponytail", kind: "Ponytail", source: "BOOTH", url: "https://booth.pm/en/items/5703253" },
  { label: "Curly Low Twintails", kind: "Curly", source: "BOOTH", url: "https://booth.pm/ja/items/8197625" },
  { label: "Male Middle Part", kind: "Male / Middle part", source: "BOOTH · Pixels", url: "https://booth.pm/en/items/4080194" },
  { label: "Masc Hair Presets 3", kind: "Male / Short", source: "BOOTH · VThreads", url: "https://booth.pm/en/items/3497715" },
  { label: "12 Real-time Woman Hairstyles", kind: "Female pack", source: "Sketchfab", url: "https://sketchfab.com/3d-models/12-real-time-woman-hairstyles-collection-02-cdcc0d801e01485fa918738199f3ebd4" },
  { label: "21 Realtime Man Hairstyles", kind: "Male pack", source: "Sketchfab", url: "https://sketchfab.com/3d-models/free-21-realtime-man-hairstyles-collection-6a876007572c464da5184eb99af0c5f7" },
];

function hairLike(o: THREE.Object3D): boolean {
  if (!(o instanceof THREE.Mesh)) return false;
  // Never inspect the avatar root name: "HairSample_Female" names the entire avatar.
  // Exclude face/body geometry even when an asset has a misleading material name.
  if (/face|body|skin|eye|eyebrow|mouth|tooth|teeth|tongue|outfit|cloth/i.test(o.name)) return false;
  const hairPattern = /hair|bangs|fringe|ponytail|ツインテ|髪|前髪|後髪|ヘア/i;
  if (hairPattern.test(o.name)) return true;
  const parent = o.parent?.name ?? "";
  if (/^(hair|bangs|fringe|ponytail|髪|前髪|後髪|ヘア)(?:[_\s.-]|$)/i.test(parent)) return true;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  return mats.some(m => m && /hair|髪|ヘア/i.test(m.name));
}

function hairMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse(o => { if (hairLike(o)) result.push(o as THREE.Mesh); });
  return result.filter(o => !result.some(parent => parent !== o && o.parent === parent));
}

function headBone(root: THREE.Object3D): THREE.Object3D | null {
  let exact: THREE.Object3D | null = null;
  let loose: THREE.Object3D | null = null;
  root.traverse(o => {
    if (o instanceof THREE.Bone && /(?:^|_)Head$/i.test(o.name)) exact = o;
    else if (!loose && o instanceof THREE.Bone && /head/i.test(o.name)) loose = o;
  });
  return exact || loose;
}

function disposeHair(group: THREE.Group): void {
  group.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => m.dispose());
  });
}

function freezeDonorHair(root: THREE.Object3D): HairGroup {
  root.updateMatrixWorld(true);
  const donorHead = headBone(root);
  if (!donorHead) throw new Error("File không có xương Head để canh tóc.");
  donorHead.updateMatrixWorld(true);
  const members = hairMeshes(root);
  if (!members.length) throw new Error("Không tìm được hair mesh tách riêng trong file này.");
  const group = new THREE.Group() as HairGroup;
  group.name = "TryOnHair";
  const inverseHead = donorHead.matrixWorld.clone().invert();
  for (const original of members) {
    const geometry = original.geometry.clone();
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const originalAttr = original.geometry.getAttribute("position") as THREE.BufferAttribute;
    if (!attr || !originalAttr) continue;
    const v = new THREE.Vector3();
    const skinned = original instanceof THREE.SkinnedMesh ? original : null;
    if (skinned) skinned.skeleton.update();
    for (let i = 0; i < attr.count; i++) {
      v.fromBufferAttribute(originalAttr, i);
      if (skinned) skinned.applyBoneTransform(i, v);
      v.applyMatrix4(original.matrixWorld).applyMatrix4(inverseHead);
      attr.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.deleteAttribute("skinIndex");
    geometry.deleteAttribute("skinWeight");
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mats = Array.isArray(original.material) ? original.material.map(m => m.clone()) : original.material.clone();
    const mesh = new THREE.Mesh(geometry, mats);
    mesh.name = original.name;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  if (!group.children.length) throw new Error("Không tạo được mesh tóc hợp lệ.");
  group.userData.sourceName = root.name;
  return group;
}

function makeViewer(host: HTMLDivElement): Viewer {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#151325");
  const camera = new THREE.PerspectiveCamera(33, 1, 0.01, 50);
  camera.position.set(0, 1.55, 1.8);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.domElement.style.touchAction = "none";
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 0.45;
  controls.maxDistance = 4.3;
  controls.target.set(0, 1.5, 0);
  scene.add(new THREE.HemisphereLight("#e5edff", "#39243d", 2.25));
  const key = new THREE.DirectionalLight("#ffffff", 2.5);
  key.position.set(2.4, 4.5, 3.0);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#d1a8ff", 1.35);
  fill.position.set(-2, 2.0, -2);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 64), new THREE.MeshStandardMaterial({ color: "#242035", roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);
  const viewer: Viewer = { scene, camera, renderer, controls, loader: new GLTFLoader(), root: null, head: null, baseHair: [], groups: new Map(), animationId: 0 };
  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  viewer.disposeResize = () => observer.disconnect();
  resize();
  const tick = () => {
    controls.update();
    renderer.render(scene, camera);
    viewer.animationId = requestAnimationFrame(tick);
  };
  tick();
  return viewer;
}

function installAvatar(viewer: Viewer, root: THREE.Object3D) {
  for (const group of viewer.groups.values()) {
    group.parent?.remove(group);
    disposeHair(group);
  }
  viewer.groups.clear();
  if (viewer.root) viewer.scene.remove(viewer.root);
  viewer.root = root;
  viewer.scene.add(root);
  root.updateMatrixWorld(true);
  viewer.head = headBone(root);
  if (!viewer.head) {
    const anchor = new THREE.Group();
    anchor.name = "TryOnHeadAnchor";
    anchor.position.y = 1.55;
    root.add(anchor);
    viewer.head = anchor;
  }
  viewer.baseHair = hairMeshes(root);
  viewer.baseHair.forEach(o => { o.visible = true; });
  const aim = new THREE.Vector3();
  viewer.head.getWorldPosition(aim);
  viewer.controls.target.copy(aim).add(new THREE.Vector3(0, -0.08, 0));
  viewer.camera.position.copy(viewer.controls.target).add(new THREE.Vector3(0, 0.10, 1.15));
  viewer.controls.update();
}

const VIEWS = ["Chính diện", "Góc 35°", "Bên trái", "Phía sau", "Toàn thân"] as const;
type View = (typeof VIEWS)[number];

export default function VitaHairTryOnPage() {
  const host = useRef<HTMLDivElement | null>(null);
  const viewer = useRef<Viewer | null>(null);
  const serial = useRef(0);
  const [status, setStatus] = useState("Đang khởi tạo viewer…");
  const [avatarName, setAvatarName] = useState("Vita gốc · VRoid CC0");
  const [isVariantA, setIsVariantA] = useState(false);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [batching, setBatching] = useState(false);
  const [selected, setSelected] = useState("original");
  const [pending, setPending] = useState<string | null>("avatar");
  const [customHair, setCustomHair] = useState<HairGroup | null>(null);
  const [scale, setScale] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [depth, setDepth] = useState(0);
  const [view, setView] = useState<View>("Chính diện");
  const [showSources, setShowSources] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PHOTO_STORE_KEY);
      if (raw) setPhotos(JSON.parse(raw) as Record<string, string>);
    } catch { /* private browsing or unavailable storage */ }
  }, []);

  useEffect(() => {
    if (!host.current) return;
    let alive = true;
    let v: Viewer;
    try { v = makeViewer(host.current); viewer.current = v; }
    catch { setPending(null); setStatus("Thiết bị không khởi tạo được WebGL."); return; }
    const bootToken = serial.current;
    async function boot() {
      try {
        const saved = await loadSavedVariantA();
        if (saved) {
          try {
            const model = await v.loader.parseAsync(saved, "");
            if (!alive || serial.current !== bootToken) return;
            installAvatar(v, model.scene);
            setAvatarName("Vita Premium Variant A · V1.1");
            setIsVariantA(true);
            setStatus("Đã tự động khôi phục Vita Variant A từ bộ nhớ iPhone. Thử chọn tóc bên dưới.");
            return;
          } catch {
            // Keep original CC0 available when the cached GLB is invalid.
          }
        }
        const model = await v.loader.loadAsync(BASE_VITA);
        if (!alive || serial.current !== bootToken) return;
        installAvatar(v, model.scene);
        setAvatarName("Vita gốc · VRoid CC0");
        setIsVariantA(false);
        setStatus("Vita CC0 đã tải. Nạp Vita-Premium-Cute-V11.glb một lần để V2 tự dùng Variant A ở lần sau.");
      } catch (error) {
        if (alive && serial.current === bootToken) setStatus("Không tải được Vita: " + String(error));
      } finally {
        if (alive && serial.current === bootToken) setPending(null);
      }
    }
    void boot();
    return () => {
      alive = false;
      serial.current++;
      cancelAnimationFrame(v.animationId);
      v.disposeResize?.();
      v.controls.dispose();
      for (const group of v.groups.values()) disposeHair(group);
      v.renderer.dispose();
      v.renderer.domElement.remove();
      viewer.current = null;
    };
  }, []);

  const resetFit = useCallback(() => {
    setScale(1); setHorizontal(0); setVertical(0); setDepth(0);
  }, []);

  const setStyle = useCallback(async (id: string) => {
    const v = viewer.current;
    if (!v?.root || !v.head) return;
    const token = ++serial.current;
    const style = READY.find(x => x.id === id);
    if (!style && id !== "custom") return;
    setPending(id);
    setStatus(id === "original" ? "Đã chọn tóc Vita gốc." : "Đang tải và chuyển hair mesh…");
    try {
      let group = id === "custom" ? customHair : v.groups.get(id);
      if (id !== "original" && !group) {
        const donor = await v.loader.loadAsync(style!.url!);
        group = freezeDonorHair(donor.scene);
        if (token !== serial.current) { disposeHair(group); return; }
        v.groups.set(id, group);
      }
      if (token !== serial.current) return;
      for (const [name, existing] of v.groups) {
        existing.visible = name === id;
      }
      if (id === "custom" && group) {
        if (group.parent !== v.head) v.head.add(group);
        group.visible = true;
      }
      if (group && id !== "custom" && group.parent !== v.head) v.head.add(group);
      v.baseHair.forEach(o => { o.visible = id === "original"; });
      if (group) {
        group.scale.setScalar(scale);
        group.position.set(horizontal / 100, vertical / 100, depth / 100);
      }
      setSelected(id);
      setStatus(id === "original" ? "Tóc Vita gốc đã được khôi phục." : "Đã gắn mesh tóc thật lên Head của Vita. Hãy xoay để kiểm tra fit.");
    } catch (error) {
      if (token === serial.current) setStatus("Không thể thử kiểu này: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      if (token === serial.current) setPending(null);
    }
  }, [customHair, scale, horizontal, vertical, depth]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    const g = selected === "custom" ? customHair : v.groups.get(selected);
    if (g) {
      g.scale.setScalar(scale);
      g.position.set(horizontal / 100, vertical / 100, depth / 100);
    }
  }, [scale, horizontal, vertical, depth, selected, customHair]);

  const loadAvatarFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(glb|vrm)$/i.test(file.name)) { setStatus("Chỉ hỗ trợ file nhị phân .glb hoặc .vrm."); return; }
    const token = ++serial.current;
    setPending("avatar");
    setStatus("Đang import Vita A: " + file.name);
    try {
      const content = await file.arrayBuffer();
      const gltf = await new GLTFLoader().parseAsync(content, "");
      if (token !== serial.current || !viewer.current) return;
      installAvatar(viewer.current, gltf.scene);
      if (customHair) disposeHair(customHair);
      setCustomHair(null);
      setAvatarName("Vita Premium Variant A · " + file.name);
      setIsVariantA(true);
      setSelected("original");
      resetFit();
      const stored = await saveVariantA(content);
      setStatus(stored
        ? "Đã nạp Variant A và lưu cục bộ trên thiết bị. Lần sau sẽ tự mở nhân vật này."
        : "Đã nạp Variant A. Bộ nhớ trình duyệt không cho phép lưu, lần sau có thể cần nạp lại.");
    } catch (error) {
      if (token === serial.current) setStatus("Không đọc được model: " + String(error));
    } finally { if (token === serial.current) setPending(null); }
  };

  const loadHairFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(glb|vrm)$/i.test(file.name)) { setStatus("Chỉ hỗ trợ .glb/.vrm."); return; }
    const token = ++serial.current;
    setPending("custom");
    setStatus("Đang tách tóc từ file " + file.name);
    try {
      const gltf = await new GLTFLoader().parseAsync(await file.arrayBuffer(), "");
      const group = freezeDonorHair(gltf.scene);
      if (token !== serial.current || !viewer.current?.head) { disposeHair(group); return; }
      if (customHair) { customHair.parent?.remove(customHair); disposeHair(customHair); }
      viewer.current.groups.set("custom", group);
      setCustomHair(group);
      for (const [name, old] of viewer.current.groups) old.visible = name === "custom";
      viewer.current.head.add(group);
      viewer.current.baseHair.forEach(o => { o.visible = false; });
      group.scale.setScalar(scale);
      group.position.set(horizontal / 100, vertical / 100, depth / 100);
      setSelected("custom");
      setStatus("Đã gắn tóc từ " + file.name + ". Kiểm tra lệch đầu bằng thanh Fit bên dưới.");
    } catch (error) {
      if (token === serial.current) setStatus("Không nhận được hair mesh: " + String(error));
    } finally { if (token === serial.current) setPending(null); }
  };

  const changeView = (label: View) => {
    const v = viewer.current;
    if (!v) return;
    const target = v.controls.target.clone();
    const offsets: Record<View, [number, number, number]> = {
      "Chính diện": [0, 0.08, 1.15],
      "Góc 35°": [0.66, 0.08, 0.95],
      "Bên trái": [1.15, 0.04, 0],
      "Phía sau": [0, 0.08, -1.15],
      "Toàn thân": [0, 0.2, 3.1],
    };
    if (label === "Toàn thân" && v.root) {
      const box = new THREE.Box3().setFromObject(v.root);
      box.getCenter(target);
    }
    v.controls.target.copy(target);
    const offset = offsets[label];
    v.camera.position.copy(target).add(new THREE.Vector3(...offset));
    v.controls.update();
    setView(label);
  };

  return (
    <main className="hair-tryon">
      <header className="hair-hero">
        <p className="hair-kicker">AUDITION · ISOLATED CHARACTER ART POC</p>
        <h1>Vita Hair Studio <span>✦</span></h1>
        <p>Thử tóc thật trong không gian 3D, xoay nhân vật, kiểm tra fit và lưu lựa chọn trước khi triển khai Cosmetics Shop.</p>
      </header>
      <div className="hair-layout">
        <section className="hair-view-panel" aria-label="Trình xem Vita 3D">
          <div className="hair-view-top">
            <span className="hair-live-dot">● &nbsp; REAL 3D · WEBGL</span>
            <span>{avatarName}</span>
          </div>
          <div ref={host} className="hair-canvas" role="img" aria-label="Mô hình Vita 3D. Vuốt để xoay và chụm hai ngón để thu phóng."/>
          <div className="hair-view-bottom">
            <span>Vuốt xoay · Chụm zoom</span>
            <span>{pending ? "Đang xử lý…" : "Head attachment · Preview"}</span>
          </div>
          <div className="hair-camera-tabs">
            {VIEWS.map(label => <button key={label} type="button" className={view === label ? "active" : ""} onClick={() => changeView(label)}>{label}</button>)}
          </div>
          <p className="hair-status" aria-live="polite">{status}</p>
        </section>
        <section className="hair-controls">
          <div className="hair-section-heading"><div><small>01 / WORKING SOURCES</small><h2>Thử tóc trên Vita</h2></div><span className="hair-count">{READY.length} lựa chọn</span></div>
          <p className="hair-help">Hai mẫu HairSample là VRM CC0 thật. Lần thử đầu sẽ tải file từ GitHub, có thể mất thời gian trên 4G.</p>
          <div className="hair-ready-grid">
            {READY.map(option => <button key={option.id} type="button" disabled={!!pending} onClick={() => void setStyle(option.id)} className={selected === option.id ? "hair-choice active" : "hair-choice"}>
              <span className="hair-choice-ico">✦</span><strong>{option.label}</strong><small>{option.note}</small><em>{selected === option.id ? "Đang hiển thị" : "Thử 3D"}</em>
            </button>)}
            {customHair && <button type="button" disabled={!!pending} onClick={() => void setStyle("custom")} className={selected === "custom" ? "hair-choice active" : "hair-choice"}><span className="hair-choice-ico">✧</span><strong>Tóc từ file</strong><small>Asset bạn chọn</small><em>{selected === "custom" ? "Đang hiển thị" : "Thử 3D"}</em></button>}
          </div>
          <div className="hair-uploads">
            <label className="hair-upload">Nạp Vita Variant A (.glb/.vrm)<input type="file" accept=".glb,.vrm" onChange={e => { void loadAvatarFile(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}/></label>
            <label className="hair-upload">Nạp một hairstyle (.glb/.vrm)<input type="file" accept=".glb,.vrm" onChange={e => { void loadHairFile(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}/></label>
          </div>
          <p className="hair-help">Model mặc định là Vita CC0 gốc. Để xem đúng khuôn mặt và outfit Variant A đã duyệt, chọn <strong>Vita-Premium-Cute-V11.glb</strong> trong Library. File được xử lý ngay trên thiết bị, không upload lên server.</p>
          <details className="hair-fit">
            <summary>02 / Chỉnh fit tóc · Scale / Offset</summary>
            <label>Tỷ lệ <output>{Math.round(scale * 100)}%</output><input type="range" min="0.7" max="1.4" step="0.01" value={scale} onChange={e => setScale(Number(e.currentTarget.value))}/></label>
            <label>Dịch ngang <output>{horizontal} cm</output><input type="range" min="-18" max="18" step="0.5" value={horizontal} onChange={e => setHorizontal(Number(e.currentTarget.value))}/></label>
            <label>Dịch cao <output>{vertical} cm</output><input type="range" min="-18" max="18" step="0.5" value={vertical} onChange={e => setVertical(Number(e.currentTarget.value))}/></label>
            <label>Dịch sâu <output>{depth} cm</output><input type="range" min="-18" max="18" step="0.5" value={depth} onChange={e => setDepth(Number(e.currentTarget.value))}/></label>
            <button type="button" onClick={resetFit}>Đặt lại fit</button>
          </details>
          <div className="hair-section-heading hair-source-heading"><div><small>03 / CURATED SOURCES</small><h2>Kiểu tóc đã lọc</h2></div><button className="hair-link-button" type="button" onClick={() => setShowSources(x => !x)}>{showSources ? "Thu gọn" : "Mở rộng"}</button></div>
          <p className="hair-help">Các kiểu dưới đây mới có trang nguồn, <strong>chưa có asset đã import và kiểm tra license</strong>; không giả lập việc thử tóc. Có file .glb/.vrm hợp lệ thì dùng nút “Nạp một hairstyle” ở trên.</p>
          {showSources && <div className="hair-candidate-list">{CANDIDATES.map(c => <div className="hair-candidate" key={c.url}><div><strong>{c.label}</strong><small>{c.kind} · {c.source}</small><span>Chưa có mesh để thử</span></div><a href={c.url} target="_blank" rel="noopener noreferrer">Xem nguồn ↗</a></div>)}</div>}
          <p className="hair-footer">Prototype chỉ phục vụ nghiên cứu mỹ thuật. Không thay Character Catalog, RoomState, Gameplay hoặc production assets. Chưa kiểm chứng FPS iPhone.</p>
        </section>
      </div>
    </main>
  );
}