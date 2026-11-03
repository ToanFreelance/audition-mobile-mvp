"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./style.module.css";

type Outfit = "basic" | "premium";
type CameraMode = "full" | "front" | "threeQuarter" | "face";
type Runtime = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction;
  basic: THREE.SkinnedMesh[];
  premium: THREE.SkinnedMesh[];
  actor: THREE.Group;
  initialPose: Map<THREE.Bone, { pos: THREE.Vector3; quat: THREE.Quaternion }>;
  clipLength: number;
  resize: () => void;
  setCamera: (mode: CameraMode) => void;
};
const ASSET_ROOT = "/tools/fashion-ab-dance-v1";
const ASSETS = {
  basic: ASSET_ROOT + "/FashionAB_Basic_DanceRig_V1.glb",
  premium: ASSET_ROOT + "/FashionAB_Premium_DanceRig_V1.glb",
};
const isWearable = (mesh: THREE.SkinnedMesh, prefix: string) => {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((material) => material.name.startsWith(prefix));
};

function applyCamera(stage: Runtime, preset: CameraMode) {
  const camera = stage.camera;
  const focus = new THREE.Vector3(0, preset === "face" ? 2.35 : 1.34, 0);
  const offset: Record<CameraMode, [number, number, number]> = {
    full: [0, 1.60, 3.75],
    front: [0, 1.55, 3.25],
    threeQuarter: [1.65, 1.69, 3.15],
    face: [0, 2.36, 0.98],
  };
  camera.position.set(...offset[preset]);
  stage.controls.target.copy(focus);
  stage.controls.update();
}

function resetRig(stage: Runtime) {
  stage.action.stop();
  stage.mixer.stopAllAction();
  for (const [bone, transform] of stage.initialPose) {
    bone.position.copy(transform.pos);
    bone.quaternion.copy(transform.quat);
  }
  stage.actor.updateMatrixWorld(true);
}

export default function FashionABDancePage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const outfitRef = useRef<Outfit>("basic");
  const [outfit, setOutfit] = useState<Outfit>("basic");
  const [playing, setPlaying] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>("full");
  const [status, setStatus] = useState<"loading"|"ready"|"error">("loading");
  const [details, setDetails] = useState("Đang tải 2 GLB, kiểm tra skeleton và animation...");
  const [stageInfo, setStageInfo] = useState({ joints: 0, basic: 0, premium: 0, clip: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let frameId = 0;
    let resizeObserver: ResizeObserver | undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x231a38);
    scene.fog = new THREE.Fog(0x231a38, 5.4, 10.5);
    const camera = new THREE.PerspectiveCamera(37, 1, 0.025, 50);
    camera.position.set(0, 1.6, 3.75);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.23;
    renderer.setClearColor(0x231a38);
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 0.7;
    controls.maxDistance = 7;
    controls.maxPolarAngle = Math.PI * 0.87;
    controls.target.set(0, 1.34, 0);

    scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x8262a0, 2.2));
    const key = new THREE.DirectionalLight(0xffefff, 2.8);
    key.position.set(-2, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8faeff, 1.1);
    fill.position.set(3, 2, -2);
    scene.add(fill);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.18, 80),
      new THREE.MeshBasicMaterial({ color: 0x7852a4, transparent: true, opacity: 0.33 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.035;
    scene.add(floor);
    const stageRing = new THREE.Mesh(
      new THREE.RingGeometry(1.16, 1.178, 80),
      new THREE.MeshBasicMaterial({ color: 0xd6b9fe, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    stageRing.rotation.x = -Math.PI / 2;
    stageRing.position.y = -0.024;
    scene.add(stageRing);

    const resize = () => {
      if (disposed) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2_200_000 / (width * height)));
      renderer.setPixelRatio(Math.max(1, dpr));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const clock = new THREE.Clock();
    const render = () => {
      if (disposed) return;
      frameId = requestAnimationFrame(render);
      const dt = Math.min(0.05, clock.getDelta());
      if (runtimeRef.current && !runtimeRef.current.action.paused &&
        runtimeRef.current.action.isRunning()) {
        runtimeRef.current.mixer.update(dt);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    const initialize = async () => {
      try {
        const loader = new GLTFLoader();
        const [basicGltf, premiumGltf] = await Promise.all([
          loader.loadAsync(ASSETS.basic),
          loader.loadAsync(ASSETS.premium),
        ]);
        if (disposed) return;
        const actor = basicGltf.scene;
        actor.updateMatrixWorld(true);
        const basicSkins: THREE.SkinnedMesh[] = [];
        actor.traverse((object) => {
          if (object instanceof THREE.SkinnedMesh && isWearable(object, "basic")) basicSkins.push(object);
        });
        let refSkeleton: THREE.Skeleton | undefined;
        actor.traverse((object) => {
          if (!refSkeleton && object instanceof THREE.SkinnedMesh) refSkeleton = object.skeleton;
        });
        const reference = refSkeleton as THREE.Skeleton | undefined;
        if (!reference || reference.bones.length !== 17 || !basicSkins.length) {
          throw new Error("Basic rig/garment không hợp lệ (cần 17 joints và SkinnedMesh)");
        }
        const premiumSkins: THREE.SkinnedMesh[] = [];
        premiumGltf.scene.traverse((object) => {
          if (!(object instanceof THREE.SkinnedMesh) || !isWearable(object, "premium")) return;
          const sourceBones = object.skeleton.bones;
          if (sourceBones.length !== reference.bones.length ||
              sourceBones.some((bone, i) => bone.name !== reference.bones[i].name)) {
            throw new Error("Thứ tự skeleton giữa Basic và Premium không khớp");
          }
          const wearable = object.clone(false);
          const sharedSkeleton = new THREE.Skeleton(
            reference.bones,
            object.skeleton.boneInverses.map((matrix) => matrix.clone()),
          );
          wearable.bind(sharedSkeleton, object.bindMatrix.clone());
          wearable.frustumCulled = false;
          wearable.visible = false;
          wearable.name = "AB_Premium_" + object.name;
          actor.add(wearable);
          premiumSkins.push(wearable);
        });
        if (!premiumSkins.length || !basicGltf.animations.length) {
          throw new Error("Thiếu outfit Premium hoặc clip DanceLoop");
        }
        const clip = basicGltf.animations.find((item) => item.name === "DanceLoop_8Beats_FashionQA") ||
          basicGltf.animations[0];
        const mixer = new THREE.AnimationMixer(actor);
        const mixerIdentity = THREE.MathUtils.generateUUID();
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity).play();
        const initialPose = new Map<THREE.Bone, { pos: THREE.Vector3; quat: THREE.Quaternion }>();
        for (const bone of reference.bones) {
          initialPose.set(bone, { pos: bone.position.clone(), quat: bone.quaternion.clone() });
        }
        const stage: Runtime = {
          renderer, camera, controls, mixer, action, actor,
          basic: basicSkins, premium: premiumSkins,
          initialPose, clipLength: clip.duration,
          resize, setCamera(mode) { applyCamera(stage, mode); },
        };
        if (disposed) return;
        scene.add(actor);
        runtimeRef.current = stage;
        stage.setCamera("full");
        setStageInfo({
          joints: reference.bones.length, basic: basicSkins.length,
          premium: premiumSkins.length, clip: clip.duration,
        });
        setStatus("ready");
        setDetails("Một actor · một AnimationMixer · hai nhóm SkinnedMesh chung 17 joints");
        const diagnostics = window as Window & {
          __fashionAbQa?: {
            read: () => { actorUuid: string; mixerUuid: string; basicVisible: number;
              premiumVisible: number; danceTime: number; boneQuaternion: number[] };
          };
        };
        diagnostics.__fashionAbQa = {
          read: () => ({
            actorUuid: actor.uuid,
            mixerUuid: mixerIdentity,
            basicVisible: basicSkins.filter((mesh) => mesh.visible).length,
            premiumVisible: premiumSkins.filter((mesh) => mesh.visible).length,
            danceTime: action.time,
            boneQuaternion: reference.bones[2].quaternion.toArray(),
          }),
        };
      } catch (cause) {
        if (!disposed) {
          setStatus("error");
          const message = cause instanceof Error ? cause.message : String(cause);
          setError(message);
          setDetails("Không mở được GLB / skeleton: " + message);
          console.error("[FashionAB QA]", cause);
        }
      }
    };
    initialize();
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      runtimeRef.current?.mixer.stopAllAction();
      runtimeRef.current = null;
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      (window as Window & { __fashionAbQa?: unknown }).__fashionAbQa = undefined;
    };
  }, []);

  const chooseOutfit = (next: Outfit) => {
    const runtime = runtimeRef.current;
    if (!runtime || status !== "ready") return;
    for (const mesh of runtime.basic) mesh.visible = next === "basic";
    for (const mesh of runtime.premium) mesh.visible = next === "premium";
    outfitRef.current = next;
    setOutfit(next);
  };

  const changeMotion = (next: boolean) => {
    const runtime = runtimeRef.current;
    if (!runtime || status !== "ready") return;
    setPlaying(next);
    if (next) runtime.action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    else resetRig(runtime);
  };

  const changeCamera = (mode: CameraMode) => {
    runtimeRef.current?.setCamera(mode);
    setCameraMode(mode);
  };

  return <main className={styles.page}>
    <div className={styles.shell}>
      <div className={styles.eyebrow}>AUDITION MOBILE MVP · INDEPENDENT FASHION STYLE LAB</div>
      <h1>Fashion A+B <span>Basic / Premium + Dance QA</span></h1>
      <p className={styles.intro}>Hai bộ đồ 3D có hình dáng khác nhau, cùng một nhân vật và skeleton.
        Thử thay đồ khi đang nhảy để phát hiện clipping và lỗi bind.</p>

      <div className={styles.viewer}>
        <div ref={hostRef} className={styles.canvas} />
        <div className={styles.overlayTop}>
          <span className={styles.liveTag}>● WEBGL · 3D SKINNING</span>
          <span className={styles.outfitTag}>{outfit === "basic" ? "BASIC · Modern Cute" : "PREMIUM · Fashion Idol"}</span>
        </div>
        <div className={styles.overlayBottom}>
          {status === "loading" ? "Đang tải GLB và kiểm tra bộ xương…" :
            status === "error" ? "Không tải được mô hình: " + error :
            playing ? "DanceLoop 8 nhịp · xoay 1 ngón tay, zoom 2 ngón tay" :
              "Tư thế tĩnh · dùng tay xoay nhân vật để quan sát"}
        </div>
      </div>

      <section className={styles.panel}>
        <h2>01 — Outfit modular</h2>
        <div className={styles.choices}>
          <button type="button" disabled={status !== "ready"}
            className={outfit === "basic" ? styles.selected : ""}
            onClick={() => chooseOutfit("basic")} aria-pressed={outfit === "basic"}>
            <b>Basic ✨</b>
            <span>Cardigan tím · váy xếp ly · sneakers</span>
          </button>
          <button type="button" disabled={status !== "ready"}
            className={outfit === "premium" ? styles.selected : ""}
            onClick={() => chooseOutfit("premium")} aria-pressed={outfit === "premium"}>
            <b>Premium ⚡</b>
            <span>Jacket cá tính · corset · váy layer · boots</span>
          </button>
        </div>
        <p className={styles.note}>Đổi outfit bằng việc bật/tắt SkinnedMesh trên cùng skeleton, không load lại actor hay reset AnimationMixer.</p>
      </section>

      <section className={styles.panel}>
        <h2>02 — Animation & camera QA</h2>
        <div className={styles.choices}>
          <button type="button" disabled={status !== "ready"}
            className={playing ? styles.selected : ""}
            onClick={() => changeMotion(true)} aria-pressed={playing}>▶ Dance Loop (4s)</button>
          <button type="button" disabled={status !== "ready"}
            className={!playing ? styles.selected : ""}
            onClick={() => changeMotion(false)} aria-pressed={!playing}>■ Dừng / Reset Pose</button>
        </div>
        <div className={styles.cameraGrid}>
          {([
            ["full", "Toàn thân"], ["front", "Chính diện"],
            ["threeQuarter", "Góc 3/4"], ["face", "Cận mặt"],
          ] as [CameraMode, string][]).map(([key, label]) => (
            <button key={key} type="button" disabled={status !== "ready"}
              className={cameraMode === key ? styles.selected : ""}
              aria-pressed={cameraMode === key}
              onClick={() => changeCamera(key)}>{label}</button>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <h2>03 — Kết quả rig</h2>
        <div className={styles.status} role="status">{details}</div>
        <div className={styles.metrics}>
          <div><b>{stageInfo.joints || "—"}</b><small>Joints chung</small></div>
          <div><b>{stageInfo.basic || "—"}</b><small>Basic SkinnedMesh</small></div>
          <div><b>{stageInfo.premium || "—"}</b><small>Premium SkinnedMesh</small></div>
          <div><b>{stageInfo.clip ? stageInfo.clip.toFixed(1)+"s" : "—"}</b><small>Dance Clip</small></div>
        </div>
        <div className={styles.downloads}>
          <a href={ASSETS.basic} download>Tải Basic GLB</a>
          <a href={ASSETS.premium} download>Tải Premium GLB</a>
        </div>
        <p className={styles.fine}>Đây là model procedural để kiểm chứng rig, mesh và quy trình modular, <b>chưa phải nhân vật 3D art-final</b> theo concept đã duyệt. Animation này độc lập hoàn toàn với WebAudio và gameplay.</p>
      </section>
    </div>
  </main>;
}
