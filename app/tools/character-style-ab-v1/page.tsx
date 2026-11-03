"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./style.module.css";
import { CharacterAnimationQa, QA_MOTIONS, type QaMotion } from "./AnimationQa";
import { rebuildModularPreview, disposeOverlay, type EyeLook, type HairLook, type OutfitLook } from "./ModularPrototype";

type CharacterKey = "soft" | "fashion";
type CameraKey = "full" | "front" | "left" | "right" | "face";
type SourceStatus = "loading" | "ready" | "error";
type RenderQuality = "smooth" | "sharp" | "ultra";

const ASSETS: Record<CharacterKey, { label: string; description: string; path: string }> = {
  soft: {
    label: "Soft Mature",
    description: "VRoid AvatarSample_A • dáng trưởng thành, mặt anime mềm",
    path: "AvatarSample_A.vrm",
  },
  fashion: {
    label: "Fashion Idol",
    description: "VRoid AvatarSample_B • outfit street-fashion, màu tím",
    path: "AvatarSample_B.vrm",
  },
};
const SOURCES = [
  "https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/",
  "https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/stable/",
];

type Stage = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  model: THREE.Group | null;
  animationId: number;
  mixer: THREE.AnimationMixer | null;
  resize?: () => void;
  clock: THREE.Clock;
};

function disposeTree(object: THREE.Object3D) {
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry?.dispose();
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of mats) {
      if (!material) continue;
      const record = material as THREE.Material & {
        map?: THREE.Texture; normalMap?: THREE.Texture; emissiveMap?: THREE.Texture;
        metalnessMap?: THREE.Texture; roughnessMap?: THREE.Texture; alphaMap?: THREE.Texture;
      };
      for (const key of ["map", "normalMap", "emissiveMap", "metalnessMap", "roughnessMap", "alphaMap"] as const) {
        record[key]?.dispose();
      }
      material.dispose();
    }
  });
}

function rendererMaxAnisotropy(renderer: THREE.WebGLRenderer): number {
  return Math.max(1, renderer.capabilities.getMaxAnisotropy());
}

function setCamera(stage: Stage, view: CameraKey) {
  const { camera, controls } = stage;
  const poses: Record<CameraKey, { position: [number, number, number]; target: [number, number, number] }> = {
    full: { position: [0, 1.42, 5.7], target: [0, 1.36, 0] },
    front: { position: [0, 1.73, 3.3], target: [0, 1.67, 0] },
    left: { position: [2.3, 1.85, 2.9], target: [0, 1.78, 0] },
    right: { position: [-2.3, 1.85, 2.9], target: [0, 1.78, 0] },
    face: { position: [0, 2.37, 1.46], target: [0, 2.34, 0] },
  };
  const pose = poses[view];
  camera.position.set(...pose.position);
  controls.target.set(...pose.target);
  controls.update();
}

export default function CharacterStyleABV1() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<THREE.Group | null>(null);
  const qaRunnerRef = useRef<CharacterAnimationQa | null>(null);
  const baseFacingRef = useRef(0);
  const localFilenameRef = useRef<string>("");
  const qualityRef = useRef<RenderQuality>("sharp");
  const localUrlRef = useRef<string | null>(null);
  const [character, setCharacter] = useState<CharacterKey>("soft");
  const [cameraView, setCameraView] = useState<CameraKey>("full");
  const [status, setStatus] = useState<SourceStatus>("loading");
  const [message, setMessage] = useState("Đang khởi tạo WebGL2…");
  const [assetName, setAssetName] = useState<string>("");
  const [eyeLook, setEyeLook] = useState<EyeLook>("natural");
  const [hairLook, setHairLook] = useState<HairLook>("classic");
  const [outfitLook, setOutfitLook] = useState<OutfitLook>("basic");
  const [glasses, setGlasses] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState("Mở model B để thử các vật phẩm modular.");
  const [qaMotion, setQaMotion] = useState<QaMotion>("off");
  const [qaDetails, setQaDetails] = useState("Chưa nạp rig để kiểm tra.");
  const [autoRotate, setAutoRotate] = useState(false);
  const [flip, setFlip] = useState(false);
  const [softLighting, setSoftLighting] = useState(true);
  const [quality, setQuality] = useState<RenderQuality>("sharp");
  const [qualityInfo, setQualityInfo] = useState("Đang đo framebuffer WebGL…");
  const [textureInfo, setTextureInfo] = useState("Chưa đọc texture.");
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;
    const testCanvas = document.createElement("canvas");
    if (!testCanvas.getContext("webgl2")) {
      setMessage("Thiết bị không hỗ trợ WebGL2.");
      setStatus("error");
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.04, 100);
    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.1));
    renderer.setClearAlpha(0);
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.7;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.autoRotateSpeed = 0.6;

    const hemi = new THREE.HemisphereLight(0xfff3ff, 0x48395c, 2.0);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(3.5, 5, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe8b7ff, 1.35);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const stageDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.34, 0.12, 64),
      new THREE.MeshStandardMaterial({ color: 0x30243e, metalness: 0.25, roughness: 0.7 }),
    );
    stageDisk.position.y = -0.12;
    scene.add(stageDisk);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.27, 0.012, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0xcda2ff }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.046;
    scene.add(ring);

    const stage: Stage = {
      scene, camera, controls, renderer, model: null, mixer: null, clock: new THREE.Clock(),
      animationId: 0,
    };
    stageRef.current = stage;
    setCamera(stage, "full");

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const preset = qualityRef.current;
      const ratioCap = preset === "ultra" ? 3 : preset === "sharp" ? 2.1 : 1.4;
      const budget = preset === "ultra" ? 3_600_000 : preset === "sharp" ? 2_500_000 : 1_400_000;
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, ratioCap, Math.sqrt(budget / (width * height))));
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      setQualityInfo("DPR " + dpr.toFixed(2) + " / " + (window.devicePixelRatio || 1).toFixed(2) +
        " · Canvas " + Math.round(size.x) + "×" + Math.round(size.y) + " px");
    };
    stage.resize = resize;
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const tick = () => {
      stage.animationId = requestAnimationFrame(tick);
      const delta = Math.min(stage.clock.getDelta(), 0.05);
      const qaRunner = qaRunnerRef.current;
      if (qaRunner && qaRunner.getMode() !== "off") qaRunner.update(delta);
      else stage.mixer?.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      observer.disconnect();
      stage.resize = undefined;
      cancelAnimationFrame(stage.animationId);
      stage.mixer?.stopAllAction();
      qaRunnerRef.current?.dispose();
      qaRunnerRef.current = null;
      disposeOverlay(overlayRef.current);
      overlayRef.current = null;
      controls.dispose();
      if (stage.model) {
        scene.remove(stage.model);
        disposeTree(stage.model);
      }
      stageDisk.geometry.dispose();
      (stageDisk.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.controls.autoRotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.renderer.toneMappingExposure = softLighting ? 1.25 : 0.98;
  }, [softLighting]);

  useEffect(() => {
    qualityRef.current = quality;
    stageRef.current?.resize?.();
  }, [quality]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (stage.model) stage.model.rotation.y = baseFacingRef.current + (flip ? Math.PI : 0);
  }, [flip]);

  useEffect(() => {
    const stage = stageRef.current;
    if (stage) setCamera(stage, cameraView);
  }, [cameraView, status]);

  useEffect(() => {
    qaRunnerRef.current?.setMode(qaMotion);
  }, [qaMotion, status]);

  const selectQaMotion = (mode: QaMotion) => {
    setQaMotion(mode);
    qaRunnerRef.current?.setMode(mode);
    if (mode !== "off") {
      const group = QA_MOTIONS.find((entry) => entry.id === mode)?.group;
      const view: CameraKey = group === "face" ? "face" : group === "head" ? "front" : "full";
      setCameraView(view);
      if (stageRef.current) setCamera(stageRef.current, view);
    }
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage?.model || status !== "ready") return;
    const result = rebuildModularPreview(stage.model, overlayRef.current, {
      eye: eyeLook, hair: hairLook, outfit: outfitLook, glasses,
    });
    overlayRef.current = result.group;
    const eyeState = result.irisMaterialCount
      ? "Iris material: " + result.irisMaterialCount + " (đổi màu trực tiếp)"
      : "Iris mesh chưa tách riêng: chỉ minh họa hiệu ứng mắt";
    const skinned = outfitLook === "premium"
      ? result.skinnedGarments
        ? "Premium SkinnedMesh: " + result.skinnedGarments + " / " + result.skinnedSources + " nguồn"
        : "Không có garment SkinnedMesh được nhận diện, chỉ thay material"
      : "Basic (không gắn lớp skin)";
    setCatalogStatus(eyeState + " · Tóc: " + result.hairMaterialCount +
      " material · Trang phục: " + result.outfitMaterialCount + " material · " + skinned);
  }, [status, character, eyeLook, hairLook, outfitLook, glasses, reloadKey]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let canceled = false;
    setStatus("loading");
    setAssetName("");
    setMessage("Đang nạp mesh VRM mới (không dùng Claude/EyePack cũ)…");
    stage.mixer?.stopAllAction();
    stage.mixer = null;
    qaRunnerRef.current?.dispose();
    qaRunnerRef.current = null;
    setQaMotion("off");
    setQaDetails("Đang phân tích skeleton và facial morph…");
    disposeOverlay(overlayRef.current);
    overlayRef.current = null;
    if (stage.model) {
      stage.scene.remove(stage.model);
      disposeTree(stage.model);
      stage.model = null;
    }
    const loader = new GLTFLoader();
    loader.setCrossOrigin("anonymous");

    const paths = localUrl
      ? [localUrl]
      : SOURCES.map((prefix) => prefix + ASSETS[character].path);

    const load = (index: number) => {
      if (canceled) return;
      if (index >= paths.length) {
        setStatus("error");
        setMessage("Không tải được nguồn VRM. Bạn có thể chọn tệp .vrm/.glb trên thiết bị để xem thử.");
        return;
      }
      loader.load(
        paths[index],
        (gltf) => {
          if (canceled) {
            disposeTree(gltf.scene);
            return;
          }
          const model = gltf.scene;
          model.updateMatrixWorld(true);
          const textures = new Set<THREE.Texture>();
          let nativeSkinnedCount = 0;
          model.traverse((object) => {
            if (object instanceof THREE.SkinnedMesh) nativeSkinnedCount++;
            if (!(object instanceof THREE.Mesh)) return;
            const mats = Array.isArray(object.material) ? object.material : [object.material];
            for (const mat of mats) {
              const m = mat as THREE.Material & {
                map?: THREE.Texture; normalMap?: THREE.Texture;
                emissiveMap?: THREE.Texture; roughnessMap?: THREE.Texture;
              };
              for (const tex of [m.map, m.normalMap, m.emissiveMap, m.roughnessMap]) {
                if (tex) {
                  textures.add(tex);
                  tex.anisotropy = Math.min(4, rendererMaxAnisotropy(stage.renderer));
                  tex.needsUpdate = true;
                }
              }
            }
          });
          let maxDimension = 0;
          for (const tex of textures) {
            const image = tex.image as { width?: number; height?: number } | null;
            if (image?.width && image?.height) maxDimension = Math.max(maxDimension, image.width, image.height);
          }
          setTextureInfo(nativeSkinnedCount + " SkinnedMesh nguồn · " + textures.size + " textures" +
            (maxDimension ? " · tối đa " + maxDimension + " px" : " · chưa đọc được kích thước"));
          const bounds = new THREE.Box3().setFromObject(model);
          const dimensions = bounds.getSize(new THREE.Vector3());
          if (!Number.isFinite(dimensions.y) || dimensions.y <= 0) {
            setMessage("Tệp không chứa mesh 3D hợp lệ.");
            setStatus("error");
            return;
          }
          const scale = 2.65 / dimensions.y;
          model.scale.setScalar(scale);
          model.position.set(
            -(bounds.min.x + bounds.max.x) * 0.5 * scale,
            -bounds.min.y * scale,
            -(bounds.min.z + bounds.max.z) * 0.5 * scale,
          );
          const root = new THREE.Group();
          root.add(model);
          // VRM 0.x is authored facing -Z. The preview camera is at +Z.
          // Normalizing at the outer root fixes both VRoid samples while
          // retaining the "Đảo mặt trước / sau" diagnostic toggle.
          const sourceIsVrm = !localUrl ||
            /\.vrm$/i.test(localFilenameRef.current) ||
            Boolean((gltf.parser as unknown as {
              json?: { extensions?: Record<string, unknown> };
            }).json?.extensions?.VRM);
          baseFacingRef.current = sourceIsVrm ? Math.PI : 0;
          root.rotation.y = baseFacingRef.current + (flip ? Math.PI : 0);
          stage.scene.add(root);
          stage.model = root;
          const qaRunner = new CharacterAnimationQa(model, gltf.parser);
          qaRunnerRef.current = qaRunner;
          setQaDetails(qaRunner.summary);
          if (gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            const idle = gltf.animations.find((clip) => /idle/i.test(clip.name)) ?? gltf.animations[0];
            mixer.clipAction(idle).play();
            stage.mixer = mixer;
          }
          setStatus("ready");
          setMessage("Đang xem mesh 3D thật • dùng một ngón để xoay, hai ngón để zoom");
          setAssetName(localUrl ? "Tệp VRM/GLB tải lên" : ASSETS[character].label);
        },
        (event) => {
          if (!canceled && event.total) {
            const percent = Math.min(100, Math.round(event.loaded / event.total * 100));
            setMessage("Đang tải nhân vật 3D: " + percent + "%");
          }
        },
        () => load(index + 1),
      );
    };
    load(0);
    return () => {
      canceled = true;
    };
  }, [character, localUrl, reloadKey]);

  const selectFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    localFilenameRef.current = file.name;
    if (!/\.(vrm|glb)$/i.test(file.name)) {
      setStatus("error");
      setMessage("Chỉ hỗ trợ .vrm hoặc .glb.");
      return;
    }
    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    const url = URL.createObjectURL(file);
    localUrlRef.current = url;
    setLocalUrl(url);
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => () => {
    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
  }, []);

  const pickCharacter = (id: CharacterKey) => {
    if (localUrlRef.current) {
      URL.revokeObjectURL(localUrlRef.current);
      localUrlRef.current = null;
      setLocalUrl(null);
    }
    setCharacter(id);
    setFlip(false);
    setCameraView("full");
    setReloadKey((value) => value + 1);
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>AUDITION MOBILE MVP • ISOLATED STYLE LAB</div>
          <h1>Character B — Modular <span>Prototype V1.3</span></h1>
          <p>Thử <b>Fashion B × Soft Anime A</b>, thay đổi mắt, tóc, outfit Basic/Premium và kính trên nhân vật 3D thật. Các lớp vật phẩm đang ở mức thử nghiệm visual.</p>
        </header>

        <div className={styles.layout}>
          <section className={styles.viewer} aria-label="Trình xem nhân vật 3D">
            <div ref={viewportRef} className={styles.canvas} />
            <div className={styles.viewerTop}>
              <span className={styles.live}>● WEBGL2 • REAL 3D</span>
              <span className={styles.viewerName}>{assetName || "VRoid Character Candidate"}</span>
            </div>
            <div className={styles.viewerBottom}>
              {status === "loading" && <span className={styles.loader} aria-hidden="true" />}
              <span>{message}</span>
              {status === "error" && <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Thử tải lại</button>}
            </div>
          </section>

          <aside className={styles.panel}>
            <div className={styles.section}>
              <h2>01 — Chọn hướng khuôn mặt</h2>
              <div className={styles.twoChoices}>
                {(Object.keys(ASSETS) as CharacterKey[]).map((id) => (
                  <button key={id} type="button" onClick={() => pickCharacter(id)}
                    className={character === id && !localUrl ? styles.activeChoice : styles.choice}>
                    <strong>{ASSETS[id].label}</strong>
                    <small>{id === "soft" ? "Ưu tiên mặt • dịu, trưởng thành" : "Ưu tiên outfit • street-fashion"}</small>
                  </button>
                ))}
              </div>
              <p className={styles.description}>{localUrl ? "Đang xem tệp bạn vừa chọn." : ASSETS[character].description}</p>
            </div>

            <div className={styles.section}>
              <h2>02 — Góc nhìn</h2>
              <div className={styles.cameraGrid}>
                {([
                  ["full", "Toàn thân"], ["front", "Chính diện"], ["left", "3/4 trái"],
                  ["right", "3/4 phải"], ["face", "Cận mặt"],
                ] as [CameraKey, string][]).map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={cameraView === key}
                    className={cameraView === key ? styles.selectedCamera : styles.cameraButton}
                    onClick={() => { setCameraView(key); stageRef.current && setCamera(stageRef.current, key); }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h2>03 — Hiển thị</h2>
              <div className={styles.toggleList}>
                <label><input type="checkbox" checked={softLighting} onChange={(e) => setSoftLighting(e.target.checked)} /> Ánh sáng Soft Anime</label>
                <label><input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} /> Tự xoay 360°</label>
                <label><input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} /> Đảo mặt trước / sau</label>
              </div>
              <div className={styles.qualityTitle}>Chất lượng hiển thị / Retina</div>
              <div className={styles.qualityGrid}>
                {([
                  ["smooth", "Mượt"], ["sharp", "Sắc nét"], ["ultra", "Ultra"],
                ] as [RenderQuality, string][]).map(([id, label]) => (
                  <button type="button" key={id}
                    aria-pressed={quality === id}
                    className={quality === id ? styles.qualityActive : styles.qualityButton}
                    onClick={() => setQuality(id)}>{label}</button>
                ))}
              </div>
              <div className={styles.qualityInfo} role="status">{qualityInfo}</div>
              <div className={styles.qualityInfo}>{textureInfo}</div>
              <p className={styles.fine}>Ultra chỉ dành cho QA chất lượng: nếu nóng máy hoặc giảm FPS, chọn Sắc nét hoặc Mượt.</p>
            </div>

            <div className={styles.section}>
              <h2>04 — Modular Look Catalog (visual)</h2>
              <p className={styles.description}>Basic / Premium dùng chung skeleton VRoid; lớp Premium thử nghiệm là SkinnedMesh kế thừa skin weights của trang phục gốc. Không thực hiện mua hàng.</p>
              <div className={styles.presetLabel}>Mắt / Iris</div>
              <div className={styles.presetGrid}>
                {([["natural", "Natural"], ["doll", "Doll • tím"], ["idol", "Idol • xanh"]] as [EyeLook, string][]).map(([key, label]) =>
                  <button type="button" key={key} className={eyeLook === key ? styles.presetActive : styles.presetChoice} onClick={() => setEyeLook(key)} aria-pressed={eyeLook === key}>{label}</button>
                )}
              </div>
              <div className={styles.presetLabel}>Tóc</div>
              <div className={styles.presetGrid}>
                {([["classic", "Classic"], ["pony", "Ponytail"]] as [HairLook, string][]).map(([key, label]) =>
                  <button type="button" key={key} className={hairLook === key ? styles.presetActive : styles.presetChoice} onClick={() => setHairLook(key)} aria-pressed={hairLook === key}>{label}</button>
                )}
              </div>
              <div className={styles.presetLabel}>Outfit</div>
              <div className={styles.presetGrid}>
                {([["basic", "Basic"], ["premium", "Premium • Skinned"]] as [OutfitLook, string][]).map(([key, label]) =>
                  <button type="button" key={key} className={outfitLook === key ? styles.presetActive : styles.presetChoice} onClick={() => setOutfitLook(key)} aria-pressed={outfitLook === key}>{label}</button>
                )}
              </div>
              <label className={styles.accessorySwitch}><input type="checkbox" checked={glasses} onChange={(e) => setGlasses(e.target.checked)} /> Kính thời trang ✨</label>
              <p className={styles.catalogStatus} role="status">{catalogStatus}</p>
            </div>
            <div className={styles.section}>
              <h2>05 — Animation QA (cục bộ)</h2>
              <p className={styles.description}>
                Kiểm tra mesh khi mặt, cổ, tay và chân chuyển động. Animation QA độc lập với gameplay, không ảnh hưởng WebAudio.
              </p>
              <div className={styles.qaGrid}>
                {QA_MOTIONS.map(({ id, name }) => (
                  <button key={id} type="button" aria-pressed={qaMotion === id}
                    disabled={status !== "ready"}
                    className={qaMotion === id ? styles.qaActive : styles.qaButton}
                    onClick={() => selectQaMotion(id)}>{name}</button>
                ))}
              </div>
              <button type="button" className={styles.qaReset}
                disabled={status !== "ready"}
                onClick={() => selectQaMotion("off")}>■ Dừng / Reset Pose</button>
              <p className={styles.qaDetails} role="status">{qaDetails}</p>
              <p className={styles.fine}>
                Facial QA chỉ hoạt động với morph có thật trong VRM. Nếu thiếu morph, chọn bài test sẽ không tạo biểu cảm giả.
                Outfit Premium hiện là geometry thử nghiệm, chưa phải quần áo SkinnedMesh.
              </p>
            </div>
            <div className={styles.section}>
              <h2>06 — Tệp 3D khác</h2>
              <input ref={uploadRef} accept=".vrm,.glb" type="file" className={styles.hidden} onChange={selectFile} />
              <button className={styles.uploadButton} type="button" onClick={() => uploadRef.current?.click()}>
                Mở VRM / GLB của bạn
              </button>
              <p className={styles.fine}>File được xem trực tiếp trên thiết bị, không upload lên server của game.</p>
            </div>

            <div className={styles.notice}>
              <strong>Phạm vi demo</strong>
              <p>Demo này dùng model VRoid sample B, overlay 3D tháo/lắp được và tùy chỉnh màu material. Đây chưa phải bộ mắt/áo quần production được fit &amp; skinned chuẩn; không thay gameplay hoặc Character Catalog.</p>
            </div>
          </aside>
        </div>

        <footer className={styles.footer}>
          <span>3D source: VRoid Studio AvatarSample_A/B by pixiv — dùng làm visual prototype.</span>
          <a href="https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z" target="_blank" rel="noreferrer">Điều kiện sử dụng VRoid</a>
        </footer>
      </div>
    </main>
  );
}
