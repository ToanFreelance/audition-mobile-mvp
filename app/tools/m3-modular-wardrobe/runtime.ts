"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { makeMotionClip, MOTIONS, type MotionId } from "./motions";

// Isolated research-only runtime. These are public, third-party source URLs,
// NOT files checked into Audition or approved for asset redistribution.
const SOURCE = "https://raw.githubusercontent.com/memelotsqui/character-assets/main/drophunter/";
const SOURCE_FALLBACK = "https://cdn.jsdelivr.net/gh/memelotsqui/character-assets@main/drophunter/";
const BODY = "body/drophunter.vrm";
// "eyes" is a REQUIRED anatomical trait in Drophunter's source manifest.
// It is not an outfit slot, and must be installed only once with the base.
const EYES = "eyes/regulareyes.vrm";
const BPM = 110;
const EPSILON = 0.0001;

export type WardrobeSlot = "top" | "bottom" | "shoes" | "hair" | "outer" | "accessory";
export type WardrobeOption = { id: string; label: string; file: string };
export type WardrobeSnapshot = {
  ready: boolean;
  message: string;
  error: string | null;
  bones: number;
  mixerCount: number;
  baseReloads: number;
  equipped: Record<WardrobeSlot, string | null>;
  cacheSize: number;
  moving: boolean;
  maxBindDelta: number;
  eyesReady: boolean;
  motionId: MotionId;
  motionTracks: number;
};

export const WARDROBE: Record<WardrobeSlot, WardrobeOption[]> = {
  top: [
    { id: "tanktop", label: "Tank Top", file: "chest/tanktop.vrm" },
    { id: "croptop", label: "Crop Top", file: "chest/croptop.vrm" },
    { id: "hoodie", label: "Hoodie", file: "chest/hoodie.vrm" },
    { id: "jumpsuittop", label: "Jumpsuit Top", file: "chest/jumpsuittop.vrm" },
    { id: "lightshirt", label: "Light Shirt", file: "chest/lightshirt.vrm" },
    { id: "shirt", label: "Shirt", file: "chest/shirt.vrm" },
    { id: "sweater", label: "Sweater", file: "chest/sweater.vrm" },
    { id: "tuckedshirt", label: "Tucked Shirt", file: "chest/tuckedshirt.vrm" },
    { id: "dress", label: "Dress", file: "chest/dress.vrm" },
    { id: "fulljacket", label: "Full Jacket", file: "chest/fulljacket.vrm" },
  ],
  bottom: [
    { id: "skirt", label: "Skirt", file: "legs/skirt.vrm" },
    { id: "cargopants", label: "Cargo Pants", file: "legs/cargopants.vrm" },
    { id: "doublebeltpants", label: "Double Belt", file: "legs/doublebeltpants.vrm" },
    { id: "jumpsuitpants", label: "Jumpsuit Pants", file: "legs/jumpsuitpants.vrm" },
    { id: "abovekneeshorts", label: "Knee Shorts", file: "legs/abovekneeshorts.vrm" },
    { id: "casualshorts", label: "Casual Shorts", file: "legs/casualshorts.vrm" },
    { id: "sportshorts", label: "Sport Shorts", file: "legs/sportshorts.vrm" },
    { id: "sportshortswithanklebands", label: "Ankle Band Shorts", file: "legs/sportshortswithanklebands.vrm" },
    { id: "waistshorts", label: "Waist Shorts", file: "legs/waistshorts.vrm" },
  ],
  shoes: [
    { id: "dressboots2", label: "Short Boots", file: "feet/dressboots2.vrm" },
    { id: "thinshoe", label: "Thin Shoes", file: "feet/thinshoe.vrm" },
    { id: "hightop", label: "High Tops", file: "feet/hightop.vrm" },
    { id: "sneakers", label: "Sneakers", file: "feet/sneakers.vrm" },
    { id: "tennisshoes", label: "Tennis Shoes", file: "feet/tennisshoes.vrm" },
    { id: "designershoes", label: "Designer Shoes", file: "feet/designershoes.vrm" },
    { id: "dressboots", label: "Dress Boots", file: "feet/dressboots.vrm" },
    { id: "shortboots", label: "Ankle Boots", file: "feet/shortboots.vrm" },
    { id: "designertallboots", label: "Designer Tall Boots", file: "feet/designertallboots.vrm" },
    { id: "tallboots", label: "Tall Boots", file: "feet/tallboots.vrm" },
  ],
  hair: [
    { id: "curledbangs", label: "Curled Bangs", file: "head/curledbangs.vrm" },
    { id: "ponytail", label: "Ponytail", file: "head/ponytail.vrm" },
    { id: "buns", label: "Buns", file: "head/buns.vrm" },
    { id: "dreds", label: "Dreads", file: "head/dreds.vrm" },
    { id: "longspike", label: "Long Spikes", file: "head/longspike.vrm" },
    { id: "short", label: "Short", file: "head/short.vrm" },
    { id: "shortband", label: "Short Band", file: "head/shortband.vrm" },
    { id: "shortcurve", label: "Short Curved", file: "head/shortcurve.vrm" },
    { id: "straight", label: "Straight", file: "head/straight.vrm" },
    { id: "swept", label: "Swept", file: "head/swept.vrm" },
  ],
  outer: [
    { id: "halfjacket", label: "Half Jacket", file: "outer/halfjacket.vrm" },
    { id: "jacket", label: "Jacket", file: "outer/jacket.vrm" },
    { id: "shortjacket", label: "Short Jacket", file: "outer/shortjacket.vrm" },
  ],
  accessory: [
    { id: "hipbelt", label: "Hip Belt", file: "accessories/hipbelt.vrm" },
    { id: "legstrapandcompress", label: "Leg Strap", file: "accessories/legstrapandcompress.vrm" },
  ],
};

// Explicit equivalents of the Drophunter manifest typeRestrictions.
// These do not attempt geometry/skin fitting and cannot prevent every clash.
const SOLO_TOPS = new Set(["hoodie", "dress", "fulljacket"]);
const PANTS = new Set(["cargopants", "doublebeltpants", "jumpsuitpants"]);
const TALL_BOOTS = new Set(["designertallboots", "tallboots"]);
export function unavailableReason(
  slot: WardrobeSlot, optionId: string, equipped: Record<WardrobeSlot, string | null>,
): string | null {
  if (slot === "outer" && SOLO_TOPS.has(equipped.top ?? "")) return "Tháo hoodie/áo nguyên bộ trước khi mặc áo khoác.";
  if (PANTS.has(equipped.bottom ?? "") && slot === "shoes" && TALL_BOOTS.has(optionId)) return "Quần dài không phối với boots cao trong manifest M3.";
  if (PANTS.has(equipped.bottom ?? "") && slot === "accessory" && optionId === "legstrapandcompress") return "Leg Strap không dùng cùng quần dài.";
  return null;
}

const initial: Record<WardrobeSlot, string> = {
  top: "tanktop", bottom: "skirt", shoes: "dressboots2", hair: "curledbangs",
  outer: "none", accessory: "none",
};

type SourcePart = { scene: THREE.Group; meshes: THREE.SkinnedMesh[] };
const slots: WardrobeSlot[] = ["top", "bottom", "shoes", "hair", "outer", "accessory"];

function getSkinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const found: THREE.SkinnedMesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) found.push(node);
  });
  return found;
}

function disposeScene(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => material.dispose());
  });
}

function skeletonCompatible(base: THREE.Skeleton, incoming: THREE.Skeleton): number {
  if (incoming.bones.length !== base.bones.length) {
    throw new Error(`Không khớp skeleton: ${incoming.bones.length}/${base.bones.length} bones.`);
  }
  let maxDelta = 0;
  for (let i = 0; i < base.bones.length; i++) {
    if (base.bones[i].name !== incoming.bones[i].name) {
      throw new Error(`Bone #${i} không khớp: ${incoming.bones[i].name} != ${base.bones[i].name}.`);
    }
    const a = base.boneInverses[i].elements;
    const b = incoming.boneInverses[i].elements;
    for (let k = 0; k < 16; k++) maxDelta = Math.max(maxDelta, Math.abs(a[k] - b[k]));
  }
  if (maxDelta > EPSILON) {
    throw new Error(`Bind pose sai khác ${maxDelta.toExponential(2)} vượt ngưỡng ${EPSILON}.`);
  }
  return maxDelta;
}

function danceClip(skeleton: THREE.Skeleton): THREE.AnimationClip {
  const bone = (name: string) => skeleton.bones.find((candidate) => candidate.name === name);
  const beat = 60 / BPM;
  const times = [0, beat / 2, beat, beat * 1.5, beat * 2, beat * 2.5, beat * 3, beat * 3.5, beat * 4];
  const moves: Array<{ name: string; axis: "x" | "y" | "z"; angles: number[] }> = [
    { name: "upper_arm.L", axis: "z", angles: [0, -0.16, -0.64, -0.42, 0, -0.12, -0.56, -0.30, 0] },
    { name: "upper_arm.R", axis: "z", angles: [0, 0.56, 0.18, 0.50, 0, 0.62, 0.22, 0.38, 0] },
    { name: "lower_arm.L", axis: "x", angles: [0, -0.20, -0.42, -0.22, 0, -0.18, -0.35, -0.22, 0] },
    { name: "lower_arm.R", axis: "x", angles: [0, -0.28, -0.12, -0.32, 0, -0.18, -0.28, -0.14, 0] },
    { name: "upper_leg.L", axis: "x", angles: [0, 0.12, 0.16, 0.04, 0, -0.07, 0.10, 0.06, 0] },
    { name: "upper_leg.R", axis: "x", angles: [0, -0.06, 0.08, 0.12, 0, 0.15, 0.11, 0.04, 0] },
    { name: "spine", axis: "y", angles: [0, -0.10, 0.02, 0.12, 0, -0.12, 0.03, 0.11, 0] },
  ];
  const tracks: THREE.KeyframeTrack[] = [];
  for (const move of moves) {
    const target = bone(move.name);
    if (!target) continue;
    const start = target.quaternion.clone();
    const values: number[] = [];
    for (const angle of move.angles) {
      const euler = new THREE.Euler(
        move.axis === "x" ? angle : 0,
        move.axis === "y" ? angle : 0,
        move.axis === "z" ? angle : 0,
      );
      const q = start.clone().multiply(new THREE.Quaternion().setFromEuler(euler));
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${target.uuid}.quaternion`, times, values));
  }
  const hips = bone("hips");
  if (hips) {
    const y = hips.position.y;
    const values = times.flatMap((_, i) => [hips.position.x, y + ([0, 0.02, 0.04, 0.01, 0, 0.025, 0.04, 0.01, 0][i]), hips.position.z]);
    tracks.push(new THREE.VectorKeyframeTrack(`${hips.uuid}.position`, times, values));
  }
  if (!tracks.length) throw new Error("Không tìm thấy các bone humanoid để chạy dance probe.");
  return new THREE.AnimationClip("M3 QA Dance · 110 BPM", beat * 4, tracks);
}

export class M3WardrobeRuntime {
  private readonly host: HTMLDivElement;
  private readonly report: (value: WardrobeSnapshot) => void;
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly resize: ResizeObserver;
  private readonly loader = new GLTFLoader();
  private readonly clock = new THREE.Clock();
  private readonly cache = new Map<string, SourcePart>();
  private readonly active = new Map<WardrobeSlot, THREE.SkinnedMesh[]>();
  private readonly eyeMeshes: THREE.SkinnedMesh[] = [];
  private readonly tokens: Record<WardrobeSlot, number> = { top: 0, bottom: 0, shoes: 0, hair: 0, outer: 0, accessory: 0 };
  private readonly equipment: Record<WardrobeSlot, string | null> = { top: null, bottom: null, shoes: null, hair: null, outer: null, accessory: null };
  private root: THREE.Group | null = null;
  private rig: THREE.Skeleton | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private readonly clips = new Map<MotionId, THREE.AnimationClip>();
  private activeAction: THREE.AnimationAction | null = null;
  private motionId: MotionId = "groove";
  private motionTracks = 0;
  private raf = 0;
  private destroyed = false;
  private ready = false;
  private moving = true;
  private error: string | null = null;
  private message = "Đang tải base Drophunter...";
  private maxBindDelta = 0;
  private eyesReady = false;
  private baseReloads = 0;
  private ground: THREE.Mesh | null = null;

  constructor(host: HTMLDivElement, report: (value: WardrobeSnapshot) => void) {
    this.host = host;
    this.report = report;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#0d1025");
    this.scene.fog = new THREE.Fog("#0d1025", 8, 20);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.01, 50);
    this.camera.position.set(0, 1, 3);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 7.5;
    this.controls.target.set(0, 0.8, 0);
    this.scene.add(new THREE.HemisphereLight("#e9e5ff", "#282842", 2.7));
    const key = new THREE.DirectionalLight("#fff2ef", 2.7);
    key.position.set(2.5, 4.5, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#74dbff", 1.5);
    rim.position.set(-2.5, 3, -2);
    this.scene.add(rim);
    this.resize = new ResizeObserver(() => this.resizeCanvas());
    this.resize.observe(host);
    this.resizeCanvas();
    this.tick();
    this.publish();
  }

  private resizeCanvas(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private tick = (): void => {
    if (this.destroyed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.moving) this.mixer?.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = window.requestAnimationFrame(this.tick);
  };

  private snapshot(): WardrobeSnapshot {
    return {
      ready: this.ready,
      message: this.message,
      error: this.error,
      bones: this.rig?.bones.length ?? 0,
      mixerCount: this.mixer ? 1 : 0,
      baseReloads: this.baseReloads,
      equipped: { ...this.equipment },
      cacheSize: this.cache.size,
      moving: this.moving,
      maxBindDelta: this.maxBindDelta,
      eyesReady: this.eyesReady,
      motionId: this.motionId,
      motionTracks: this.motionTracks,
    };
  }

  private publish(): void {
    if (!this.destroyed) this.report(this.snapshot());
  }

  private async getModel(path: string): Promise<SourcePart> {
    const cached = this.cache.get(path);
    if (cached) return cached;
    let gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>;
    try {
      gltf = await this.loader.loadAsync(SOURCE + path);
    } catch {
      gltf = await this.loader.loadAsync(SOURCE_FALLBACK + path);
    }
    const meshes = getSkinnedMeshes(gltf.scene);
    if (!meshes.length) throw new Error(`Asset ${path} không có SkinnedMesh.`);
    const part = { scene: gltf.scene, meshes };
    if (this.destroyed) {
      disposeScene(gltf.scene);
      throw new Error("Viewer đã đóng.");
    }
    this.cache.set(path, part);
    return part;
  }

  /**
   * Install the mandatory eyes on the existing canonical body skeleton.
   * Drophunter's manifest defines eyes separately from body. Without this
   * trait the sockets are empty and the viewer appears to see through the face.
   * Never create an eye-specific AnimationMixer or add its donor rig to scene.
   */
  private async installEyes(): Promise<void> {
    if (!this.root || !this.rig) throw new Error("Base chưa được nạp để gắn mắt.");
    const part = await this.getModel(EYES);
    if (this.destroyed) return;
    this.root.updateMatrixWorld(true);
    part.scene.updateMatrixWorld(true);
    const installed: THREE.SkinnedMesh[] = [];
    let localMaxDelta = 0;
    for (const sourceMesh of part.meshes) {
      localMaxDelta = Math.max(localMaxDelta, skeletonCompatible(this.rig, sourceMesh.skeleton));
      const eyes = new THREE.SkinnedMesh(sourceMesh.geometry, sourceMesh.material);
      eyes.name = "m3-required-eyes";
      eyes.frustumCulled = false;
      eyes.matrixAutoUpdate = false;
      eyes.matrix.copy(this.root.matrixWorld.clone().invert().multiply(sourceMesh.matrixWorld));
      eyes.matrixWorldNeedsUpdate = true;
      eyes.bindMode = "detached";
      eyes.bind(this.rig, sourceMesh.bindMatrix);
      // Preserve any authored morph targets (e.g. eye blink shapes).
      if (sourceMesh.morphTargetDictionary && sourceMesh.morphTargetInfluences) {
        eyes.morphTargetDictionary = { ...sourceMesh.morphTargetDictionary };
        eyes.morphTargetInfluences = [...sourceMesh.morphTargetInfluences];
      }
      installed.push(eyes);
    }
    if (!installed.length) throw new Error("Trait Eyes không chứa mesh mắt hợp lệ.");
    installed.forEach((mesh) => this.root?.add(mesh));
    this.eyeMeshes.push(...installed);
    this.maxBindDelta = Math.max(this.maxBindDelta, localMaxDelta);
    this.eyesReady = true;
  }

  async initialize(): Promise<void> {
    try {
      const loaded = await this.getModel(BODY);
      if (this.destroyed) return;
      const main = loaded.meshes.reduce((a, b) => a.skeleton.bones.length >= b.skeleton.bones.length ? a : b);
      if (main.skeleton.bones.length < 50) throw new Error("Base không có rig humanoid hợp lệ.");
      this.root = loaded.scene;
      this.rig = main.skeleton;
      this.baseReloads++;
      this.scene.add(this.root);
      this.root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(this.root);
      const center = bounds.getCenter(new THREE.Vector3());
      const height = Math.max(1, bounds.getSize(new THREE.Vector3()).y);
      this.controls.target.copy(center);
      this.camera.position.copy(center).add(new THREE.Vector3(0, height * 0.07, height * 1.8));
      this.controls.update();
      this.controls.minDistance = height * 0.7;
      this.controls.maxDistance = height * 4;
      const floorY = bounds.min.y - 0.035;
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(height * 0.63, height * 0.69, 0.035, 64),
        new THREE.MeshStandardMaterial({ color: "#292044", roughness: 0.52, metalness: 0.12 }),
      );
      platform.position.set(center.x, floorY, center.z);
      this.scene.add(platform);
      this.ground = platform;
      this.mixer = new THREE.AnimationMixer(this.root);
      for (const motion of MOTIONS) this.clips.set(motion.id, makeMotionClip(this.rig, motion.id));
      this.setMotion("groove");
      this.message = "Đang nạp Eyes bắt buộc từ manifest Drophunter...";
      this.publish();
      await this.installEyes();
      if (this.destroyed) return;
      this.ready = true;
      this.message = "Base đã nạp một lần. Đang mặc các item...";
      this.publish();
      await Promise.all(slots.filter((slot) => initial[slot] !== "none").map((slot) => this.equip(slot, initial[slot])));
      if (!this.destroyed) {
        this.message = "Sẵn sàng: thay từng item, giữ cùng actor và AnimationMixer.";
        this.publish();
      }
    } catch (err) {
      if (this.destroyed) return;
      this.error = err instanceof Error ? err.message : String(err);
      this.message = "Không thể khởi tạo model. Không dùng placeholder giả.";
      this.publish();
    }
  }

  private clearSlot(slot: WardrobeSlot): void {
    this.active.get(slot)?.forEach((mesh) => mesh.removeFromParent());
    this.active.delete(slot);
    this.equipment[slot] = null;
  }

  async equip(slot: WardrobeSlot, optionId: string): Promise<void> {
    if (!this.ready || !this.root || !this.rig || this.destroyed) return;
    const token = ++this.tokens[slot];
    if (optionId === "none" && (slot === "outer" || slot === "accessory")) {
      this.clearSlot(slot);
      this.error = null;
      this.message = slot === "outer" ? "Đã tháo áo khoác." : "Đã tháo phụ kiện.";
      this.publish();
      return;
    }
    const option = WARDROBE[slot].find((item) => item.id === optionId);
    if (!option) throw new Error(`Unknown ${slot} option: ${optionId}`);
    const blocked = unavailableReason(slot, optionId, this.equipment);
    if (blocked) {
      this.error = blocked;
      this.message = `Không thể mặc ${option.label}.`;
      this.publish();
      return;
    }
    this.error = null;
    this.message = `Đang thay ${option.label}...`;
    this.publish();
    try {
      const part = await this.getModel(option.file);
      if (this.destroyed || token !== this.tokens[slot]) return;
      this.root.updateMatrixWorld(true);
      part.scene.updateMatrixWorld(true);
      const replacement: THREE.SkinnedMesh[] = [];
      let localMax = 0;
      for (const sourceMesh of part.meshes) {
        localMax = Math.max(localMax, skeletonCompatible(this.rig, sourceMesh.skeleton));
        const worn = new THREE.SkinnedMesh(sourceMesh.geometry, sourceMesh.material);
        worn.name = `m3-${slot}-${optionId}`;
        worn.frustumCulled = false;
        // The source mesh and body are both authored in the same bind space.
        // The original donor skeleton never enters the scene or the mixer.
        const local = this.root.matrixWorld.clone().invert().multiply(sourceMesh.matrixWorld);
        worn.matrixAutoUpdate = false;
        worn.matrix.copy(local);
        worn.matrixWorldNeedsUpdate = true;
        worn.bindMode = "detached";
        worn.bind(this.rig, sourceMesh.bindMatrix);
        replacement.push(worn);
      }
      if (this.destroyed || token !== this.tokens[slot]) return;
      replacement.forEach((mesh) => this.root?.add(mesh));
      this.active.get(slot)?.forEach((mesh) => mesh.removeFromParent());
      this.active.set(slot, replacement);
      this.equipment[slot] = optionId;
      this.maxBindDelta = Math.max(this.maxBindDelta, localMax);
      if (slot === "top" && SOLO_TOPS.has(optionId) && this.equipment.outer) {
        this.tokens.outer++;
        this.clearSlot("outer");
      }
      if (slot === "bottom" && PANTS.has(optionId)) {
        if (this.equipment.accessory === "legstrapandcompress") {
          this.tokens.accessory++;
          this.clearSlot("accessory");
        }
        if (TALL_BOOTS.has(this.equipment.shoes ?? "")) void this.equip("shoes", "dressboots2");
      }
      this.message = `Đã mặc ${option.label}; base và mixer không thay đổi.`;
    } catch (err) {
      if (this.destroyed || token !== this.tokens[slot]) return;
      this.error = err instanceof Error ? err.message : String(err);
      this.message = `Không thay được ${option.label}. Giữ nguyên item cũ.`;
    }
    this.publish();
  }

  setMotion(id: MotionId): void {
    if (!this.mixer) return;
    const clip = this.clips.get(id);
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    if (this.activeAction && this.activeAction !== next) this.activeAction.fadeOut(0.2);
    if (this.activeAction !== next) {
      next.reset();
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.fadeIn(0.2).play();
    }
    this.activeAction = next;
    this.motionId = id;
    this.motionTracks = clip.tracks.length;
    this.publish();
  }

  setDance(playing: boolean): void {
    this.moving = playing;
    this.publish();
  }

  setView(view: "front" | "left" | "back"): void {
    if (!this.root) return;
    const center = this.controls.target;
    const d = this.camera.position.distanceTo(center);
    const direction = view === "front" ? [0, 0, 1] : view === "left" ? [-1, 0, 0] : [0, 0, -1];
    this.camera.position.set(center.x + direction[0] * d, center.y + d * 0.03, center.z + direction[2] * d);
    this.controls.update();
  }

  dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    slots.forEach((slot) => { this.tokens[slot]++; this.active.get(slot)?.forEach((mesh) => mesh.removeFromParent()); });
    this.eyeMeshes.forEach((mesh) => mesh.removeFromParent());
    this.eyeMeshes.length = 0;
    window.cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.clips.clear();
    this.activeAction = null;
    this.controls.dispose();
    for (const part of this.cache.values()) disposeScene(part.scene);
    this.cache.clear();
    if (this.ground) {
      this.ground.geometry.dispose();
      (this.ground.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
