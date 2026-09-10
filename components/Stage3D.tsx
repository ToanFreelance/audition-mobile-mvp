"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const COLORS = { pink: 0xff4fd8, cyan: 0x62d8ff, violet: 0x8c7dff, floor: 0x130f28 };

const CHARACTER_BASE = "https://raw.githubusercontent.com/agentkaerf/FreeModels/main/Ultimate%20Modular%20Women%20-%20April%202022/Individual%20Characters/glTF";
const OUTFITS = {
  casual: { label: "Casual", url: `${CHARACTER_BASE}/Casual.gltf` },
  punk: { label: "Punk", url: `${CHARACTER_BASE}/Punk.gltf` },
  formal: { label: "Formal", url: `${CHARACTER_BASE}/Formal.gltf` },
} as const;

type OutfitId = keyof typeof OUTFITS;
type AccessoryId = "headphones" | "glasses" | "none";

type CharacterController = {
  loadOutfit: (id: OutfitId) => void;
  nextAnimation: () => void;
  setAccessory: (id: AccessoryId) => void;
};

export default function Stage3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<CharacterController>({ loadOutfit: () => {}, nextAnimation: () => {}, setAccessory: () => {} });
  const [outfit, setOutfit] = useState<OutfitId>("casual");
  const [accessory, setAccessory] = useState<AccessoryId>("headphones");
  const [animationName, setAnimationName] = useState("loading…");
  const [assetStatus, setAssetStatus] = useState("Loading CC0 character…");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03040a);
    scene.fog = new THREE.FogExp2(0x05050e, 0.032);

    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100);
    camera.position.set(0, 3.65, 20.5);
    camera.lookAt(0, 2.7, 0.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.className = "stage-3d-canvas";
    host.appendChild(renderer.domElement);

    const stage = new THREE.Group();
    scene.add(stage);
    scene.add(new THREE.HemisphereLight(0xaaa6ff, 0x05040d, 1.55));

    const key = new THREE.DirectionalLight(0xffeaff, 2.1);
    key.position.set(2, 8, 8);
    scene.add(key);

    const spots: THREE.SpotLight[] = [];
    for (const [x, color] of [[-5, COLORS.cyan], [0, COLORS.pink], [5, COLORS.violet]] as const) {
      const light = new THREE.SpotLight(color, 45, 22, Math.PI / 7, 0.58, 1.1);
      light.position.set(x, 8, 4.5);
      light.target.position.set(0, 1.8, 0);
      scene.add(light, light.target);
      spots.push(light);
    }

    const wall = new THREE.Mesh(new THREE.BoxGeometry(19, 8.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x0c0b1c, roughness: 0.88, metalness: 0.15 }));
    wall.position.set(0, 4.2, -3.2);
    stage.add(wall);

    for (let i = -5; i <= 5; i += 1) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.38, 7.1, 0.08), new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x14132b : 0x0e0f20, roughness: 0.78, metalness: 0.18 }));
      panel.position.set(i * 1.7, 4.05, -2.88);
      stage.add(panel);
    }

    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x291347, emissive: 0x8c247f, emissiveIntensity: 0.8, metalness: 0.55, roughness: 0.35 });
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(16, 0.16, 0.18), frameMaterial);
    topFrame.position.set(0, 7.55, -2.55);
    stage.add(topFrame);
    for (const x of [-7.8, 7.8]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 7.6, 0.18), frameMaterial);
      pillar.position.set(x, 3.8, -2.55);
      stage.add(pillar);
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(23, 20), new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.55, metalness: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1.6);
    stage.add(floor);

    const grid = new THREE.GridHelper(20, 24, COLORS.pink, COLORS.violet);
    grid.position.set(0, 0.025, 1.6);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.18;
    stage.add(grid);

    for (let i = 0; i < 7; i += 1) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.7 + i * 0.68, 1.72 + i * 0.68, 64), new THREE.MeshBasicMaterial({ color: i % 2 ? COLORS.cyan : COLORS.pink, transparent: true, opacity: 0.14, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.03, 1.6);
      stage.add(ring);
    }

    const signTexture = makeNeonSignTexture();
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.5), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, depthWrite: false }));
    sign.position.set(0, 6.0, -2.5);
    stage.add(sign);

    createSpeaker(stage, -6.2, 3.0, COLORS.cyan);
    createSpeaker(stage, 6.2, 3.0, COLORS.pink);
    createSpeaker(stage, -4.7, 1.7, COLORS.violet, 0.7);
    createSpeaker(stage, 4.7, 1.7, COLORS.violet, 0.7);

    const characterSlot = new THREE.Group();
    characterSlot.position.set(0, 0.02, 0.25);
    stage.add(characterSlot);

    const loader = new GLTFLoader();
    let characterRoot: THREE.Group | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let clips: THREE.AnimationClip[] = [];
    let currentAction: THREE.AnimationAction | null = null;
    let animationIndex = 0;
    let currentAccessory: AccessoryId = "headphones";
    let accessoryObject: THREE.Group | null = null;
    let loadGeneration = 0;
    let disposed = false;

    const playClip = (index: number) => {
      if (!mixer || !clips.length) {
        setAnimationName("no clips");
        return;
      }
      animationIndex = ((index % clips.length) + clips.length) % clips.length;
      const clip = clips[animationIndex];
      const next = mixer.clipAction(clip);
      next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.25).play();
      currentAction?.fadeOut(0.25);
      currentAction = next;
      setAnimationName(clip.name || `clip ${animationIndex + 1}`);
    };

    const chooseInitialAnimation = () => {
      if (!clips.length) return 0;
      const preferred = [/dance/i, /hip/i, /idle/i, /walk/i, /run/i];
      for (const matcher of preferred) {
        const index = clips.findIndex((clip) => matcher.test(clip.name));
        if (index >= 0) return index;
      }
      return 0;
    };

    const applyAccessory = (id: AccessoryId) => {
      currentAccessory = id;
      if (accessoryObject?.parent) accessoryObject.parent.remove(accessoryObject);
      disposeObject(accessoryObject);
      accessoryObject = null;
      if (!characterRoot || id === "none") return;
      const head = findHeadBone(characterRoot);
      if (!head) return;
      accessoryObject = id === "headphones" ? createHeadphones() : createGlasses();
      head.add(accessoryObject);
    };

    const loadOutfit = (id: OutfitId) => {
      const generation = ++loadGeneration;
      setAssetStatus(`Loading ${OUTFITS[id].label}…`);
      loader.load(
        OUTFITS[id].url,
        (gltf) => {
          if (disposed || generation !== loadGeneration) {
            disposeObject(gltf.scene);
            return;
          }
          if (characterRoot) {
            mixer?.stopAllAction();
            mixer?.uncacheRoot(characterRoot);
            characterSlot.remove(characterRoot);
            disposeObject(characterRoot);
          }
          characterRoot = gltf.scene;
          normalizeCharacter(characterRoot, 5.45);
          characterSlot.add(characterRoot);
          mixer = new THREE.AnimationMixer(characterRoot);
          clips = gltf.animations;
          currentAction = null;
          animationIndex = chooseInitialAnimation();
          playClip(animationIndex);
          applyAccessory(currentAccessory);
          setAssetStatus(`${OUTFITS[id].label} · ${clips.length} animation clips`);
        },
        undefined,
        (error) => {
          if (disposed || generation !== loadGeneration) return;
          console.error("[character-demo] Failed to load CC0 character", error);
          setAssetStatus("Không tải được CC0 model — thử lại hoặc kiểm tra mạng");
          setAnimationName("unavailable");
        },
      );
    };

    controllerRef.current = {
      loadOutfit,
      nextAnimation: () => playClip(animationIndex + 1),
      setAccessory: applyAccessory,
    };

    loadOutfit("casual");

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const portrait = height > width;
      camera.fov = portrait ? 34 : 38;
      camera.position.set(0, portrait ? 3.55 : 3.65, portrait ? 23.5 : 20.5);
      camera.lookAt(0, portrait ? 2.75 : 2.7, 0.2);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      mixer?.update(dt);
      characterSlot.rotation.y = Math.sin(t * 0.55) * 0.035;
      spots.forEach((light, index) => { light.intensity = 32 + (Math.sin(t * 2.0 + index) + 1) * 8; });
      const signPulse = 1 + Math.max(0, Math.sin(t * Math.PI * 4.266)) * 0.008;
      sign.scale.set(signPulse, signPulse, signPulse);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controllerRef.current = { loadOutfit: () => {}, nextAnimation: () => {}, setAccessory: () => {} };
      mixer?.stopAllAction();
      renderer.dispose();
      signTexture.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
        else if (mesh.material) mesh.material.dispose();
      });
    };
  }, []);

  const chooseOutfit = (id: OutfitId) => {
    setOutfit(id);
    controllerRef.current.loadOutfit(id);
  };
  const chooseAccessory = (id: AccessoryId) => {
    setAccessory(id);
    controllerRef.current.setAccessory(id);
  };

  return (
    <>
      <div ref={hostRef} className="stage-3d" aria-label="3D club dance stage with animated CC0 character" />
      <div style={{ position: "absolute", left: 12, top: 118, zIndex: 46, width: "min(260px, 64vw)", padding: 10, borderRadius: 14, border: "1px solid rgba(126,227,255,.45)", background: "rgba(5,7,22,.82)", boxShadow: "0 10px 30px rgba(0,0,0,.35)", backdropFilter: "blur(10px)", color: "white", fontSize: 11, lineHeight: 1.25, pointerEvents: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 7 }}>
          <strong style={{ fontSize: 11, letterSpacing: ".08em", color: "#9cecff" }}>AVATAR DEMO · CC0</strong>
          <span style={{ opacity: 0.65, fontSize: 9 }}>Quaternius</span>
        </div>
        <div style={{ opacity: 0.72, marginBottom: 7 }}>{assetStatus}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, marginBottom: 6 }}>
          {(Object.keys(OUTFITS) as OutfitId[]).map((id) => <button key={id} onPointerDown={(event) => event.stopPropagation()} onClick={() => chooseOutfit(id)} style={demoButton(outfit === id)}>{OUTFITS[id].label}</button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, marginBottom: 6 }}>
          <button onPointerDown={(event) => event.stopPropagation()} onClick={() => chooseAccessory("headphones")} style={demoButton(accessory === "headphones")}>🎧 Headset</button>
          <button onPointerDown={(event) => event.stopPropagation()} onClick={() => chooseAccessory("glasses")} style={demoButton(accessory === "glasses")}>👓 Glasses</button>
          <button onPointerDown={(event) => event.stopPropagation()} onClick={() => chooseAccessory("none")} style={demoButton(accessory === "none")}>None</button>
        </div>
        <button onPointerDown={(event) => event.stopPropagation()} onClick={() => controllerRef.current.nextAnimation()} style={{ ...demoButton(false), width: "100%", textAlign: "left" }}>▶ Animation: <b>{animationName}</b> · tap để đổi</button>
      </div>
    </>
  );
}

function demoButton(active: boolean): React.CSSProperties {
  return { border: active ? "1px solid #7ee3ff" : "1px solid rgba(255,255,255,.16)", borderRadius: 8, background: active ? "rgba(55,154,203,.3)" : "rgba(255,255,255,.07)", color: "white", padding: "6px 7px", fontSize: 10, fontWeight: 800, cursor: "pointer" };
}

function normalizeCharacter(root: THREE.Group, targetHeight: number) {
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
}

function findHeadBone(root: THREE.Object3D) {
  let head: THREE.Bone | null = null;
  root.traverse((object) => {
    if (!head && object instanceof THREE.Bone && /head/i.test(object.name)) head = object;
  });
  return head;
}

function createHeadphones() {
  const group = new THREE.Group();
  group.name = "demo-headphones";
  const material = new THREE.MeshStandardMaterial({ color: 0x251743, emissive: 0x7c36b8, emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.35 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 28, Math.PI), material);
  band.rotation.z = Math.PI;
  band.position.set(0, 0.08, 0);
  group.add(band);
  for (const x of [-0.215, 0.215]) {
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), material);
    cup.scale.set(0.55, 1, 0.8);
    cup.position.set(x, -0.02, 0);
    group.add(cup);
  }
  group.position.set(0, 0.04, 0.01);
  return group;
}

function createGlasses() {
  const group = new THREE.Group();
  group.name = "demo-glasses";
  const material = new THREE.MeshStandardMaterial({ color: 0xff78d7, emissive: 0x9e226f, emissiveIntensity: 0.35, metalness: 0.25, roughness: 0.3 });
  for (const x of [-0.09, 0.09]) {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 7, 20), material);
    lens.position.set(x, 0, 0);
    group.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), material);
  group.add(bridge);
  group.position.set(0, 0.035, 0.145);
  group.rotation.x = -0.05;
  return group;
}

function disposeObject(root: THREE.Object3D | null) {
  if (!root) return;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach((material) => {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    });
  });
}

function createSpeaker(parent: THREE.Group, x: number, y: number, accent: number, scale = 1) {
  const group = new THREE.Group(); group.position.set(x, y, -1.55); group.scale.setScalar(scale);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x101020, roughness: 0.6 }));
  cabinet.position.y = -1.25; group.add(cabinet);
  for (const [yy, size] of [[-0.35, 0.34], [-1.05, 0.25]] as const) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(size, size * 1.15, 0.12, 24), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.75 }));
    cone.rotation.x = Math.PI / 2; cone.position.set(0, yy, 0.43); group.add(cone);
  }
  parent.add(group);
}

function makeNeonSignTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 260;
  const ctx = canvas.getContext("2d")!; ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "900 78px Arial Black, Arial, sans-serif";
  ctx.shadowColor = "#ff4fd8"; ctx.shadowBlur = 28; ctx.fillStyle = "#f67ce8"; ctx.fillText("AUDITION", 450, 145);
  ctx.shadowBlur = 12; ctx.font = "700 34px Arial, sans-serif"; ctx.fillStyle = "#f2dcff"; ctx.fillText("CLUB", 450, 62);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
