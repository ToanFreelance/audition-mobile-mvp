"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { inspectWardrobePackage, type WardrobeIntake } from "./zip-reader";
import "./wardrobe.css";

const BASE_VITA = "https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/beta/Vita.vrm";
const CYBER_BLUE = "https://booth.pm/en/items/5798462";
const APPROVED_VARIANT_HASHES = new Set([
  "d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8",
  "5e1802f4618fcf8ed182efdc856dda6f9eee4eaaee83ba889397d2a64951ea12",
]);

type Preview = {
  scene: THREE.Scene;
  root: THREE.Object3D | null;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  frame: number;
  resize: ResizeObserver;
};

function startPreview(mount: HTMLDivElement): Preview {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#17172d");
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
  camera.position.set(0, 1.5, 2.8);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  mount.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.target.set(0, 1.25, 0);
  controls.minDistance = 0.5;
  controls.maxDistance = 7;
  scene.add(new THREE.HemisphereLight("#e7e9ff", "#302a42", 2.3));
  const key = new THREE.DirectionalLight("#ffffff", 2.8);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#cdacff", 1.3);
  rim.position.set(-2, 3, -3);
  scene.add(rim);
  const grid = new THREE.GridHelper(8, 16, "#50456a", "#2b2842");
  grid.position.y = -0.006;
  scene.add(grid);
  const resize = new ResizeObserver(() => {
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  resize.observe(mount);
  const preview: Preview = { scene, root: null, camera, renderer, controls, frame: 0, resize };
  const tick = () => {
    controls.update();
    renderer.render(scene, camera);
    preview.frame = window.requestAnimationFrame(tick);
  };
  tick();
  return preview;
}

function installAvatar(preview: Preview, root: THREE.Object3D) {
  if (preview.root) preview.scene.remove(preview.root);
  preview.root = root;
  preview.scene.add(root);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  preview.controls.target.copy(center);
  preview.camera.position.copy(center).add(new THREE.Vector3(0, Math.max(0.05, size.y * 0.04), Math.max(1.75, size.y * 1.35)));
  preview.controls.update();
}

function disposePreview(preview: Preview) {
  cancelAnimationFrame(preview.frame);
  preview.resize.disconnect();
  preview.controls.dispose();
  preview.renderer.dispose();
  preview.renderer.domElement.remove();
}

function formatBytes(n: number): string {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.ceil(n / 1024)} KB`;
}

export default function VitaWardrobeLabPage() {
  const mount = useRef<HTMLDivElement | null>(null);
  const preview = useRef<Preview | null>(null);
  const itemsRef = useRef<WardrobeIntake[]>([]);
  const sourceToken = useRef(0);
  const avatarToken = useRef(0);
  const [items, setItems] = useState<WardrobeIntake[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [sourceStatus, setSourceStatus] = useState("Chưa nạp bộ trang phục. File sẽ chỉ được đọc trong trình duyệt.");
  const [avatarStatus, setAvatarStatus] = useState("Đang mở bản Vita CC0 để tham chiếu...");
  const [avatarName, setAvatarName] = useState("Vita CC0 · tham chiếu");
  const [loading, setLoading] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(true);
  const [turned, setTurned] = useState(false);

  useEffect(() => {
    if (!mount.current) return;
    let active = true;
    let current: Preview;
    try { current = startPreview(mount.current); preview.current = current; }
    catch { setAvatarBusy(false); setAvatarStatus("Thiết bị không khởi tạo được WebGL."); return; }
    const token = ++avatarToken.current;
    (async () => {
      try {
        const gltf = await new GLTFLoader().loadAsync(BASE_VITA);
        if (!active || token !== avatarToken.current) return;
        installAvatar(current, gltf.scene);
        setAvatarStatus("Đang hiển thị Vita CC0. Nạp V1.1 đã duyệt để xem đúng nhân vật đích.");
      } catch (error) {
        if (active && token === avatarToken.current) setAvatarStatus("Không tải được Vita CC0: " + String(error));
      } finally {
        if (active && token === avatarToken.current) setAvatarBusy(false);
      }
    })();
    return () => {
      active = false;
      avatarToken.current++;
      sourceToken.current++;
      for (const item of itemsRef.current) if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      disposePreview(current);
      preview.current = null;
    };
  }, []);

  const loadAvatar = async (file?: File) => {
    if (!file || !preview.current) return;
    if (!/\.(glb|vrm)$/i.test(file.name)) { setAvatarStatus("Vita chỉ nhận .glb/.vrm đã duyệt."); return; }
    const token = ++avatarToken.current;
    setAvatarBusy(true);
    setAvatarStatus("Đang kiểm tra SHA-256 và mở nhân vật...");
    try {
      const bytes = await file.arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
      if (!APPROVED_VARIANT_HASHES.has(hash)) throw new Error("SHA-256 không trùng Vita Premium Cute V1.1 đã duyệt.");
      const gltf = await new GLTFLoader().parseAsync(bytes, "");
      if (token !== avatarToken.current || !preview.current) return;
      installAvatar(preview.current, gltf.scene);
      setAvatarName("Vita Premium Cute Variant A · V1.1");
      setAvatarStatus("Đã nạp đúng Vita V1.1. Trang phục gốc giữ nguyên — chưa gắn đồ Cyber Blue.");
      setTurned(false);
    } catch (error) {
      if (token === avatarToken.current) setAvatarStatus("Không nạp được Vita: " + String(error));
    } finally {
      if (token === avatarToken.current) setAvatarBusy(false);
    }
  };

  const loadPackage = async (file?: File) => {
    if (!file) return;
    const token = ++sourceToken.current;
    setLoading(true);
    setSourceStatus("Đang kiểm tra định dạng ZIP trên chính iPhone...");
    try {
      const parsed = await inspectWardrobePackage(file);
      if (token !== sourceToken.current) {
        for (const item of parsed) if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
        return;
      }
      for (const item of itemsRef.current) if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      itemsRef.current = parsed;
      setItems(parsed);
      setSourceName(file.name);
      setSourceStatus(`Đã đọc ${parsed.length} custom item từ ${file.name}. Đây là QA định dạng/thumbnail, CHƯA chuyển thành mesh trang phục.`);
    } catch (error) {
      if (token === sourceToken.current) setSourceStatus("Không đọc được file: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      if (token === sourceToken.current) setLoading(false);
    }
  };

  const rotate = () => {
    const root = preview.current?.root;
    if (!root) return;
    root.rotation.y = turned ? 0 : Math.PI;
    setTurned(!turned);
  };

  return (
    <main className="wardrobe-lab">
      <header className="wardrobe-head">
        <small>AUDITION · ISOLATED CHARACTER ART RESEARCH</small>
        <h1>Vita Wardrobe Lab <span>✦</span></h1>
        <p>Giai đoạn 0 — kiểm tra bộ trang phục VRoid trước khi xây converter rigged clothing. Chưa can thiệp outfit hoặc skeleton đã duyệt.</p>
      </header>
      <div className="wardrobe-layout">
        <section className="wardrobe-card wardrobe-model" aria-label="Vita 3D reference">
          <div className="wardrobe-card-head"><strong>01 / VITA 3D REFERENCE</strong><span>{avatarName}</span></div>
          <div ref={mount} className="wardrobe-stage" aria-label="Nhân vật Vita 3D xoay bằng thao tác vuốt" />
          <div className="wardrobe-actions">
            <button type="button" onClick={rotate} disabled={avatarBusy || !preview.current?.root}>Quay nhân vật 180°</button>
            <label className="wardrobe-upload">Nạp Vita V1.1 đã duyệt<input type="file" accept=".glb,.vrm" disabled={avatarBusy} onChange={e => { void loadAvatar(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}/></label>
          </div>
          <p className="wardrobe-hint" role="status">{avatarStatus}</p>
          <p className="wardrobe-muted">Nhân vật chỉ là mẫu tham chiếu 3D. Danh sách ở bên cạnh chưa được gắn thành trang phục lên người.</p>
        </section>
        <section className="wardrobe-card wardrobe-sources" aria-label="Đọc gói trang phục VRoid">
          <div className="wardrobe-card-head"><strong>02 / OUTFIT SOURCE INTAKE</strong><span>Browser-only</span></div>
          <h2>Cyber Blue Outfit</h2>
          <p>Gói BOOTH gồm <strong>Top · Skirt · Shoes</strong> ở dạng <code>.vroidcustomitem</code>, chưa có garment GLB để mặc trực tiếp.</p>
          <a className="wardrobe-source" href={CYBER_BLUE} target="_blank" rel="noopener noreferrer">Xem và tải Cyber Blue trên BOOTH ↗</a>
          <label className="wardrobe-upload wardrobe-main-upload">
            {loading ? "Đang phân tích ZIP..." : "Nạp Cyber_Blue.zip hoặc .vroidcustomitem"}
            <input type="file" accept=".zip,.vroidcustomitem" disabled={loading} onChange={e => { void loadPackage(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}/>
          </label>
          <p className="wardrobe-hint" role="status">{sourceStatus}</p>
          {items.length > 0 && <>
            <div className="wardrobe-result-head"><h3>Kết quả phân tích</h3><span>{sourceName} · {items.length} item</span></div>
            <div className="wardrobe-item-list">
              {items.map((item, i) => <article className="wardrobe-item" key={item.name + i}>
                {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={"Thumbnail xuất từ " + item.name}/> : <div className="wardrobe-no-thumb">Không có thumbnail</div>}
                <div><strong>{item.name}</strong><small>{item.kind}</small><small>VRoid {item.version} · {item.entries} entry · {item.sourceFormat}</small><p>{item.notes}</p></div>
              </article>)}
            </div>
          </>}
          <div className="wardrobe-gate">
            <strong>03 / NEXT GATE — RIGGED MESH</strong>
            <p>Cần xuất/tái dựng mesh quần áo, giữ skin weights và bind pose tương thích Vita. Ở bước này <strong>không giả lập việc mặc đồ</strong> hoặc xem ảnh thumbnail là 3D garment.</p>
          </div>
          <p className="wardrobe-muted">Tệp luôn nằm trong trình duyệt, không gửi lên máy chủ. Không đăng lại asset BOOTH lên GitHub hoặc Preview. Chưa xác nhận quyền phân phối thương mại trong game.</p>
        </section>
      </div>
      <footer>POC only · No Character Catalog, gameplay, RoomState, WebAudio or approved V1.1 outfit edits</footer>
    </main>
  );
}