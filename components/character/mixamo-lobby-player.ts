import * as THREE from "three";
import { fitLobbyGarments } from "./motion/garment-fit";
import type { M3RigFamily } from "./character-catalog";
import type { Shoe } from "./motion/stances";
type Placement = { feet: [Shoe, Shoe]; pitch: [number, number]; shift: number; drop: number };
import {
  MIXAMO_BONES, MIXAMO_GROUPS, getMixamoData,
  prepareMixamoLobbyClips, type MixamoGesture, type MixamoRig,
} from "./mixamo-lobby-data";

// QA-only Mixamo player. Deliberately separate from the accepted full-body M3 idle engine.
export { prepareMixamoLobbyClips };

export type MixamoLobbyIdle = {
  readonly instanceId: string;
  readonly playbackMixer: THREE.AnimationMixer;
  elapsedSeconds: number;
  hasScratchPose: boolean;
  currentGesture: MixamoGesture;
  target: MixamoGesture | null;
  contacts: string;
  phase: string;
  floorError: number;
  placement: Placement;
  random: boolean;
  completedGestures: number;
  footDrift: number;
  maxFootDrift: number;
  animationProfile: MixamoGesture;
  clipDuration: number;
  poseTime: number;
  select(id: string): void;
  request(id: string): void;
  update(deltaSeconds: number): void;
  seekReferenceTime(seconds: number): void;
  projectReferenceJoints(camera: THREE.Camera, width: number, height: number): Record<string, [number, number, number]>;
  dispose(): void;
};

const QUAT_SCALE = 1 / 32767;
const HIP_SCALE = 1 / 10000;
const CHANNELS_PER_FRAME = MIXAMO_BONES.length * 4 + 3;
const MAX_STEP_SECONDS = 0.1;

function hashId(input: string) {
  let value = 2166136261;
  for (let i = 0; i < input.length; i++) value = Math.imul(value ^ input.charCodeAt(i), 16777619);
  return value >>> 0 || 1;
}

function findSkeleton(actor: THREE.Object3D): THREE.Skeleton | null {
  let skeleton: THREE.Skeleton | null = null;
  actor.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh && (!skeleton || mesh.skeleton.bones.length > skeleton.bones.length)) skeleton = mesh.skeleton;
  });
  return skeleton;
}

function findRigBone(rig: THREE.Skeleton, name: string): THREE.Bone | undefined {
  // GLTFLoader sanitizes punctuation in M3 bone names (e.g. foot.L -> foot_L).
  // Match the existing M3 lobby runtime's canonical and sanitized names.
  const safe = THREE.PropertyBinding.sanitizeNodeName(name);
  return rig.bones.find(item => item.name === name || item.name === safe);
}

function buildClip(rig: THREE.Skeleton, family: MixamoRig, id: MixamoGesture): THREE.AnimationClip | null {
  const data = getMixamoData(family, id);
  if (!data) return null;
  const n = data.frames;
  const samples = data.samples;
  const times = new Float32Array(n);
  for (let f = 0; f < n; f++) times[f] = f / 30;
  const tracks: THREE.KeyframeTrack[] = [];
  const q = new THREE.Quaternion();
  for (let b = 0; b < MIXAMO_BONES.length; b++) {
    const name = MIXAMO_BONES[b];
    const bone = findRigBone(rig, name);
    if (!bone) continue;
    const values = new Float32Array(n * 4);
    for (let f = 0; f < n; f++) {
      const offset = f * CHANNELS_PER_FRAME + b * 4;
      q.set(samples[offset] * QUAT_SCALE, samples[offset + 1] * QUAT_SCALE,
        samples[offset + 2] * QUAT_SCALE, samples[offset + 3] * QUAT_SCALE).normalize();
      q.toArray(values, f * 4);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(bone.uuid + ".quaternion", times, values));
  }
  const hips = findRigBone(rig, "hips");
  if (!hips) return null;
  const values = new Float32Array(n * 3);
  for (let f = 0; f < n; f++) {
    const offset = f * CHANNELS_PER_FRAME + MIXAMO_BONES.length * 4;
    for (let axis = 0; axis < 3; axis++) {
      values[f * 3 + axis] = hips.position.getComponent(axis) + samples[offset + axis] * HIP_SCALE;
    }
  }
  tracks.push(new THREE.VectorKeyframeTrack(hips.uuid + ".position", times, values));
  if (tracks.length < 20) return null;
  return new THREE.AnimationClip("mixamo-qa-" + family + "-" + id, (n - 1) / 30, tracks);
}

/** Only called in the isolated lobby sketch QA after prepareMixamoLobbyClips. */
export function createMixamoLobbyIdle(
  actor: THREE.Object3D,
  participantId: string,
  roomId: string,
  rigFamily: M3RigFamily,
  occupied: () => readonly string[] = () => [],
): MixamoLobbyIdle | null {
  if (rigFamily !== "drophunter" && rigFamily !== "neurohacker") return null;
  const rig = findSkeleton(actor);
  if (!rig) { console.warn("[mixamo-qa] M3 actor skeleton not found"); return null; }
  const family: MixamoRig = rigFamily;
  const group = MIXAMO_GROUPS[family];
  const available = [...group.base, ...group.emote, ...group.manual];
  const mixer = new THREE.AnimationMixer(actor);
  const actions = new Map<MixamoGesture, THREE.AnimationAction>();
  for (const key of available) {
    const clip = buildClip(rig, family, key);
    if (!clip) { console.warn("[mixamo-qa] missing retargeted clip", family, key, rig.bones.length); mixer.stopAllAction(); return null; }
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    actions.set(key, action);
  }
  const feet = ["foot.L", "foot.R"].map(name => findRigBone(rig, name));
  if (feet.some(foot => !foot)) {
    console.warn("[mixamo-qa] missing M3 foot bones", family, rig.bones.map(b => b.name).filter(name => /foot/i.test(name)));
    mixer.stopAllAction();
    return null;
  }
  const footBones = feet as THREE.Bone[];
  actor.updateWorldMatrix(true, true);
  const scale = Math.max(0.01, new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3()).y);
  const point = new THREE.Vector3();
  const rest = footBones.map(foot => actor.worldToLocal(foot.getWorldPosition(new THREE.Vector3())).clone());
  const garmentFit = family === "neurohacker" ? fitLobbyGarments(actor) : null;

  let seed = hashId(roomId + ":mixamo:" + participantId);
  let bag: MixamoGesture[] = [];
  let emoteBag: MixamoGesture[] = [];
  const shuffle = (pool: readonly MixamoGesture[]) => {
    const result = [...pool];
    for (let i = result.length - 1; i > 0; i--) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const j = (seed >>> 0) % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  function nextFrom(pool: readonly MixamoGesture[], which: "base" | "emote", previous?: MixamoGesture) {
    let currentBag = which === "base" ? bag : emoteBag;
    if (!currentBag.length || (currentBag.length === 1 && currentBag[0] === previous)) currentBag = shuffle(pool);
    const otherActors = occupied();
    let index = currentBag.findIndex(key => key !== previous && !otherActors.includes(key));
    if (index < 0) index = currentBag.findIndex(key => key !== previous);
    const next = currentBag.splice(Math.max(0, index), 1)[0];
    if (which === "base") bag = currentBag; else emoteBag = currentBag;
    return next;
  }
  let current = nextFrom(group.base, "base");
  let lastBase = current;
  let baseCount = 0;
  let action = actions.get(current)!.reset().setEffectiveWeight(1).play();
  let outgoing: THREE.AnimationAction | null = null;
  let fadeTime = 0;
  let queued: MixamoGesture | null = null;
  let isDisposed = false;
  const placement: Placement = {
    feet: [[0, 0, 0, 0], [0, 0, 0, 0]],
    pitch: [0, 0], shift: 0, drop: 0,
  };
  function begin(next: MixamoGesture, immediate = false) {
    const incoming = actions.get(next);
    if (!incoming) return;
    if (incoming === action) {
      action.reset().setEffectiveWeight(1).play();
      outgoing = null;
      fadeTime = 0;
    } else {
      if (outgoing) outgoing.stop();
      const duration = immediate ? 0.4 : Math.min(0.55, action.getClip().duration * 0.24);
      incoming.reset().setEffectiveWeight(1).play();
      action.crossFadeTo(incoming, duration, false);
      outgoing = action;
      fadeTime = duration;
      action = incoming;
    }
    current = next;
    queued = null;
    runtime.target = next;
    if (group.base.includes(next)) lastBase = next;
    runtime.currentGesture = next;
    runtime.animationProfile = next;
    runtime.clipDuration = action.getClip().duration;
    runtime.poseTime = 0;
  }
  function drawNext(): MixamoGesture {
    if (!group.base.includes(current)) return lastBase;
    baseCount++;
    if (baseCount % 3 === 0 && group.emote.length) return nextFrom(group.emote, "emote");
    return nextFrom(group.base, "base", current);
  }
  const projectedNames: Record<string,string> = {
    left_shoulder: "upper_arm.L", right_shoulder: "upper_arm.R", left_elbow: "lower_arm.L", right_elbow: "lower_arm.R",
    left_wrist: "hand.L", right_wrist: "hand.R", left_hip: "upper_leg.L", right_hip: "upper_leg.R",
    left_knee: "lower_leg.L", right_knee: "lower_leg.R", left_ankle: "foot.L", right_ankle: "foot.R",
  };
  const runtime: MixamoLobbyIdle = {
    instanceId: THREE.MathUtils.generateUUID(), playbackMixer: mixer,
    elapsedSeconds: 0, hasScratchPose: false, currentGesture: current,
    target: null, contacts: "DOUBLE_SUPPORT", phase: "MIXAMO_IDLE", floorError: 0,
    placement, random: true, completedGestures: 0, footDrift: 0, maxFootDrift: 0,
    animationProfile: current, clipDuration: action.getClip().duration, poseTime: 0,
    select(id) {
      if (!actions.has(id as MixamoGesture)) return;
      this.random = false;
      begin(id as MixamoGesture, true);
    },
    request(id) {
      if (!actions.has(id as MixamoGesture)) return;
      queued = id as MixamoGesture;
      this.random = false;
    },
    update(deltaSeconds) {
      if (isDisposed || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) return;
      // Keep elapsed time even during slow frames, with bounded integration steps.
      let remaining = Math.min(deltaSeconds, 4);
      while (remaining > 1e-8) {
        const dt = Math.min(remaining, MAX_STEP_SECONDS);
        remaining -= dt;
        this.elapsedSeconds += dt;
        mixer.update(dt);
        if (outgoing) {
          fadeTime -= dt;
          if (fadeTime <= 0) { outgoing.stop(); outgoing = null; this.target = null; }
        }
        const duration = action.getClip().duration;
        const lead = Math.min(0.32, duration * 0.18);
        if (!outgoing && action.time >= duration - lead && (queued || this.random)) {
          const next = queued ?? drawNext();
          if (next) { this.completedGestures++; begin(next); }
        }
      }
      this.poseTime = action.time;
      this.clipDuration = action.getClip().duration;
      this.currentGesture = current;
      this.animationProfile = current;
      const nextFeet = footBones.map((foot, i): Shoe => {
        actor.worldToLocal(foot.getWorldPosition(point));
        const height = Math.max(0, point.y - rest[i].y);
        const horizontal = Math.hypot(point.x - rest[i].x, point.z - rest[i].z);
        if (height < 0.01) this.footDrift = Math.max(this.footDrift, horizontal);
        this.floorError = Math.max(this.floorError, rest[i].y - point.y);
        return [point.x / scale, point.z / scale, height / scale, 0];
      });
      this.maxFootDrift = Math.max(this.maxFootDrift, this.footDrift);
      this.placement.feet = nextFeet as [Shoe, Shoe];
      this.contacts = nextFeet[0][2] > .01 ? "RIGHT_SUPPORT" : nextFeet[1][2] > .01 ? "LEFT_SUPPORT" : "DOUBLE_SUPPORT";
      this.phase = outgoing ? "CROSSFADE" : group.emote.includes(current) ? "MIXAMO_EMOTE" : "MIXAMO_IDLE";
      garmentFit?.update(nextFeet[1][2]);
    },
    seekReferenceTime(seconds) {
      action.time = THREE.MathUtils.clamp(seconds, 0, action.getClip().duration);
      mixer.update(0);
      this.poseTime = action.time;
    },
    projectReferenceJoints(camera, width, height) {
      const result: Record<string,[number,number,number]> = {};
      for (const [key, name] of Object.entries(projectedNames)) {
        const bone = findRigBone(rig, name);
        if (!bone) continue;
        bone.getWorldPosition(point).project(camera);
        result[key] = [(point.x + 1) * width / 2, (1-point.y) * height / 2, point.z];
      }
      return result;
    },
    dispose() {
      if (isDisposed) return;
      isDisposed = true;
      mixer.stopAllAction();
      for (const item of actions.values()) mixer.uncacheClip(item.getClip());
      mixer.uncacheRoot(actor);
    },
  };
  // Ensure the first pose is authored, never standing in the rig's bind pose.
  mixer.update(0);
  return runtime;
}