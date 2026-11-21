import * as THREE from "three";
import { createLocalReviewRetargeter } from "./mixamo-local-review";
import { fitArmStretchSleevesV10, type ArmStretchSleeveMetrics } from "./mixamo-arm-sleeve-v10";
import { createMixamoFootLock } from "./mixamo-foot-lock";
import { applyBoredPelvisCorrection } from "./mixamo-pelvis-stabilizer";
import { bakeBoredSideStepsV5, type SideStepV5Event } from "./mixamo-side-step-v5";
import { bakeBoredSideStepsV6, type SideStepV6Event } from "./mixamo-side-step-v6";
import { bakeFootContactsV7, type ClipContactV7 } from "./mixamo-foot-contact-v7";
import {
  bakePerFootContactV8, bestSupportCandidateV8,
  type FootContactV8Profile, type FootContactV8Report,
} from "./mixamo-contact-v8";
import {
  compatibleBagIndex, createMixamoContactTracker, plantedFeet,
  supportFootMismatch, transitionWindow, type FootPair,
} from "./mixamo-contact-transitions";
import { fitLobbyGarments } from "./motion/garment-fit";
import type { M3RigFamily } from "./character-catalog";
import type { Shoe } from "./motion/stances";
type Placement = { feet: [Shoe, Shoe]; pitch: [number, number]; shift: number; drop: number };
import {
  MIXAMO_BONES, MIXAMO_GROUPS, MIXAMO_AUTO_GROUPS, STATIONARY_MIXAMO_GROUPS,
  getMixamoData, getArmStretchSourceV10, getStandingGreetingSourceV11,
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
  lockedFeet: number;
  maxContactError: number;
  contactTravel: number;
  plantedRawTravel: number;
  plantedCorrectedTravel: number;
  maxContactSlip: number;
  maxCrossfadeSlip: number;
  plantedContactTravel: number;
  crossfadeContactTravel: number;
  transitionPoseGap: number;
  transitionCount: number;
  sideStepEvents: readonly SideStepV5Event[];
  sideStepV6Events: readonly SideStepV6Event[];
  contactV7Reports: readonly ClipContactV7[];
  contactV8Reports: readonly FootContactV8Report[];
  stationaryOnly: boolean;
  armStretchV10: boolean;
  greetingV11: boolean;
  armSleeveV10: ArmStretchSleeveMetrics | null;
  allowedGestures: readonly MixamoGesture[];
  v8FootContact: {
    leftCm: number; rightCm: number;
    crossfadeLeftCm: number; crossfadeRightCm: number;
    segments: number;
    transitions: Array<{
      from:string; to:string; support: readonly [boolean,boolean];
      soleGapCm:readonly [number,number]; fadeSeconds:number;
    }>;
  };
  animationProfile: MixamoGesture;
  clipDuration: number;
  poseTime: number;
  importReviewPack(text: string): readonly MixamoGesture[];
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

function buildClip(rig: THREE.Skeleton, family: MixamoRig, id: MixamoGesture, pelvisFix: boolean): THREE.AnimationClip | null {
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
  // V3 QA: source-measured, small shared pelvis translation on Bored only.
  // Never adjust rotations/leg IK/actor placement; the clip crossfade blends this track.
  if (pelvisFix) applyBoredPelvisCorrection(family, id, values, n);
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
  enableFootLock = false,
): MixamoLobbyIdle | null {
  if (rigFamily !== "drophunter" && rigFamily !== "neurohacker") return null;
  const rig = findSkeleton(actor);
  if (!rig) { console.warn("[mixamo-qa] M3 actor skeleton not found"); return null; }
  const family: MixamoRig = rigFamily;
  // Owner V9: isolate a stationary-foot shortlist. The original catalog is
  // preserved for A/B tests; no risky gesture is selected/queued in safe mode.
  const clipReview = !enableFootLock &&
    typeof window !== "undefined" &&
    window.location.pathname === "/tools/lobby-qa-sketch" &&
    new URLSearchParams(window.location.search).get("clipReview") === "1";
  const stationaryOnly = !clipReview && !enableFootLock &&
    typeof window !== "undefined" &&
    window.location.pathname === "/tools/lobby-qa-sketch" &&
    new URLSearchParams(window.location.search).get("stationaryOnly") === "1";
  // Owner accepts Arm Stretching as a candidate, not Cheering.
  // V10 is opt-in only on this existing QA route, with the existing real
  // 5-person shuffle-bag/crossfade/mixer. Both Dwarf Idles stay excluded.
  const armStretchV10 = !clipReview && !enableFootLock &&
    typeof window !== "undefined" &&
    window.location.pathname === "/tools/lobby-qa-sketch" &&
    new URLSearchParams(window.location.search).get("armStretchV10") === "1";
  const greetingV11 = !clipReview && !enableFootLock &&
    typeof window !== "undefined" &&
    window.location.pathname === "/tools/lobby-qa-sketch" &&
    new URLSearchParams(window.location.search).get("greetingV11") === "1";
  const baseGroup = clipReview ? MIXAMO_GROUPS[family]
    : stationaryOnly ? STATIONARY_MIXAMO_GROUPS[family]
    : MIXAMO_AUTO_GROUPS[family];
  const group = {
    ...baseGroup,
    base: [...baseGroup.base,
      ...(armStretchV10 ? ["arm-stretching" as const] : []),
      ...(greetingV11 ? ["standing-greeting-2" as const] : [])],
  };
  const available = [...group.base, ...group.emote, ...group.manual];
  if(armStretchV10 && !getArmStretchSourceV10()){
    console.warn("[mixamo-v10] Arm Stretching source pack not preloaded");
    return null;
  }
  if(greetingV11 && !getStandingGreetingSourceV11()){
    console.warn("[mixamo-v11] Standing Greeting source pack not preloaded");
    return null;
  }
  if (!group.base.length) return null;
  // Opt-in ONLY on the isolated sketch QA route. Foot Lock and pelvis
  // correction must never run together; V2 leg IK stays disabled here.
  const pelvisFix = !enableFootLock &&
    typeof window !== "undefined" &&
    window.location.pathname === "/tools/lobby-qa-sketch" &&
    new URLSearchParams(window.location.search).get("pelvisFix") === "1";
  const contactV4 = !enableFootLock &&
    typeof window !== "undefined" &&
    window.location.pathname === "/tools/lobby-qa-sketch" &&
    new URLSearchParams(window.location.search).get("contactV4") !== "0";
  // Never enable V5 outside the isolated Mixamo QA route.
  const sideStepV6 = contactV4 && !stationaryOnly &&
    new URLSearchParams(window.location.search).get("sideStepV6") === "1";
  const contactV7 = contactV4 &&
    new URLSearchParams(window.location.search).get("contactV7") === "1";
  const contactV8 = contactV4 && contactV7 &&
    new URLSearchParams(window.location.search).get("contactV8") === "1";
  const sideStepV5 = contactV4 && !sideStepV6 &&
    new URLSearchParams(window.location.search).get("sideStepV5") === "1";
  const mixer = new THREE.AnimationMixer(actor);
  const actions = new Map<MixamoGesture, THREE.AnimationAction>();
  for (const key of available) {
    if((key==="arm-stretching" && armStretchV10) ||
      (key==="standing-greeting-2" && greetingV11))continue;
    const clip = buildClip(rig, family, key, pelvisFix);
    if (!clip) { console.warn("[mixamo-qa] missing retargeted clip", family, key, rig.bones.length); mixer.stopAllAction(); return null; }
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);
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
  // Local source import is diagnostic only; capture native rest before playback.
  const reviewRetargeter=(clipReview||armStretchV10||greetingV11)
    ? createLocalReviewRetargeter(actor,rig,
        {greetingFrameZeroReference:greetingV11}):null;
  if(armStretchV10){
    const source=getArmStretchSourceV10()!;
    const imported=reviewRetargeter?.(source)??[];
    const arm=imported.find(item=>item.id==="arm-stretching");
    if(!arm){
      mixer.stopAllAction();
      console.warn("[mixamo-v10] Failed to retarget owner Arm Stretching");
      return null;
    }
    const newAction=mixer.clipAction(arm.clip).setLoop(THREE.LoopOnce,1);
    newAction.clampWhenFinished=true;
    actions.set("arm-stretching",newAction);
  }
  if(greetingV11){
    const source=getStandingGreetingSourceV11()!;
    const imported=reviewRetargeter?.(source)??[];
    const greeting=imported.find(item=>item.id==="standing-greeting-2");
    if(!greeting){
      mixer.stopAllAction();
      console.warn("[mixamo-v11] Failed to retarget owner Standing Greeting 2");
      return null;
    }
    // V14: the source's actual frame-zero reference is aligned inside
    // createLocalReviewRetargeter. Do NOT add V12 arm neutral blends or V13
    // overhead goal IK: both overwrite the source choreography.
    const greetingAction=mixer.clipAction(greeting.clip).setLoop(THREE.LoopOnce,1);
    greetingAction.clampWhenFinished=true;
    actions.set("standing-greeting-2",greetingAction);
  }
  actor.updateWorldMatrix(true, true);
  const scale = Math.max(0.01, new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3()).y);
  const point = new THREE.Vector3();
  const rest = footBones.map(foot => actor.worldToLocal(foot.getWorldPosition(new THREE.Vector3())).clone());
  const garmentFit = family === "neurohacker" ? fitLobbyGarments(actor) : null;
  // V10: per-actor skinned garment clone + reversible underarm morph. No bone
  // changes, no global wardrobe edits and zero influence on other clips.
  const sleeveV10 = armStretchV10 ? fitArmStretchSleevesV10(actor,family) : null;
  const footLock = enableFootLock ? createMixamoFootLock(actor, rig, scale) : null;
  // Bake once at actor startup, NEVER override an authored step during playback.
  // Only Bored is eligible for this V5 pilot; all other gestures stay untouched.
  let sideStepEvents: readonly SideStepV5Event[] = [];
  let sideStepV6Events: readonly SideStepV6Event[] = [];
  if (sideStepV5 || sideStepV6) {
    const sourceAction = actions.get("bored");
    if (sourceAction) {
      const sourceClip = sourceAction.getClip();
      const baked = sideStepV6
        ? bakeBoredSideStepsV6(actor, rig, sourceClip)
        : bakeBoredSideStepsV5(actor, rig, sourceClip, scale);
      if (sideStepV6) sideStepV6Events = baked.events as readonly SideStepV6Event[];
      else sideStepEvents = baked.events as readonly SideStepV5Event[];
      if (baked.events.length) {
        sourceAction.stop();
        mixer.uncacheClip(sourceClip);
        const next = mixer.clipAction(baked.clip).setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
        actions.set("bored", next);
      }
    }
  }
  // Offline 30 FPS contact authoring across every available Mixamo clip.
  // V6 Bored step tracks are produced FIRST; V7 never overwrites leg rotations.
  const contactV7Reports: ClipContactV7[] = [];
  if (contactV7) {
    for (const [gesture, sourceAction] of actions) {
      // Source-authoritative Arm Stretching: never warp the hips of the
      // owner-supplied clip to compensate for a different gesture's contacts.
      if((gesture==="arm-stretching" && armStretchV10) ||
        (gesture==="standing-greeting-2" && greetingV11))continue;
      const original = sourceAction.getClip();
      const baked = bakeFootContactsV7(actor, rig, original, family);
      contactV7Reports.push(baked.report);
      if (!baked.report.applied) continue;
      sourceAction.stop();
      mixer.uncacheClip(original);
      const next = mixer.clipAction(baked.clip).setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      actions.set(gesture, next);
    }
    console.info("[mixamo-contact-v7] catalog", family,
      JSON.stringify(contactV7Reports));
  }
  // Native per-foot contact authoring follows V7; clip runtime does not do IK.
  const contactV8Reports: FootContactV8Report[] = [];
  const contactV8Profiles = new Map<MixamoGesture,FootContactV8Profile>();
  if (contactV8) {
    for (const [gesture, sourceAction] of actions) {
      const original = sourceAction.getClip();
      const baked = bakePerFootContactV8(actor,rig,original);
      contactV8Profiles.set(gesture,baked.profile);
      if((gesture==="arm-stretching" && armStretchV10) ||
        (gesture==="standing-greeting-2" && greetingV11)){
        contactV8Reports.push({...baked.report,applied:false,
          reason:"Owner source: preserve authored bone and hip curves"});
        continue;
      }
      contactV8Reports.push(baked.report);
      if (!baked.report.applied) continue;
      sourceAction.stop();
      mixer.uncacheClip(original);
      const next = mixer.clipAction(baked.clip).setLoop(THREE.LoopOnce,1);
      next.clampWhenFinished = true;
      actions.set(gesture,next);
    }
    console.info("[mixamo-contact-v8] per-foot catalog",family,
      JSON.stringify(contactV8Reports));
  }
  const firstSoles = new Map<MixamoGesture,FootPair>();
  const initialSupports = new Map<MixamoGesture,readonly [boolean,boolean]>();
  for(const [id,profile] of contactV8Profiles){
    firstSoles.set(id,profile.start);
    initialSupports.set(id,profile.getContact(2/30));
  }
  const restY: readonly [number, number] = [rest[0].y, rest[1].y];
  const readFeet = (): FootPair => {
    const left = actor.worldToLocal(footBones[0].getWorldPosition(new THREE.Vector3()));
    const right = actor.worldToLocal(footBones[1].getWorldPosition(new THREE.Vector3()));
    return [[left.x, left.y, left.z], [right.x, right.y, right.z]];
  };

  const toeBones = (["toes.L","toes.R"] as const)
    .map(name=>findRigBone(rig,name));
  const readSoles = ():FootPair => {
    if (toeBones.some(b=>!b)) return readFeet();
    const asSole=(index:number):readonly [number,number,number]=>{
      const heel=actor.worldToLocal(footBones[index].getWorldPosition(new THREE.Vector3()));
      const toe=actor.worldToLocal(toeBones[index]!.getWorldPosition(new THREE.Vector3()));
      heel.lerp(toe,0.64);
      return [heel.x,heel.y,heel.z];
    };
    return [asSole(0),asSole(1)];
  };

  // Sample only the FIRST pose of each clip once per actor. The probe mixer
  // is disposed and every bone transform is restored before normal playback.
  // No per-frame IK, extra actor, or runtime re-skinning is introduced.
  const firstFootPoses = new Map<MixamoGesture, FootPair>();
  const savedBones = rig.bones.map(bone => ({
    position: bone.position.clone(), rotation: bone.quaternion.clone(), scale: bone.scale.clone(),
  }));
  const poseProbe = new THREE.AnimationMixer(actor);
  try {
    for (const [gesture, playbackAction] of (contactV4 ? actions : new Map<MixamoGesture, THREE.AnimationAction>())) {
      const clip = playbackAction.getClip();
      const probeAction = poseProbe.clipAction(clip).reset().play();
      poseProbe.update(0);
      firstFootPoses.set(gesture, readFeet());
      probeAction.stop();
      poseProbe.uncacheClip(clip);
    }
  } catch (error) {
    firstFootPoses.clear(); // Degrade to the original deterministic bag on probe failure.
    console.warn("[mixamo-qa] contact pose sampling unavailable", error);
  } finally {
    poseProbe.stopAllAction();
    poseProbe.uncacheRoot(actor);
    rig.bones.forEach((bone, index) => {
      bone.position.copy(savedBones[index].position);
      bone.quaternion.copy(savedBones[index].rotation);
      bone.scale.copy(savedBones[index].scale);
    });
    actor.updateWorldMatrix(true, true);
  }
  const contactTracker = createMixamoContactTracker(restY, scale);
  let transitionPoseGap = 0;
  let transitionCount = 0;
  let poseSelectionReady = false;

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
    const distinct = currentBag.filter(key => key !== previous);
    const unoccupied = distinct.filter(key => !otherActors.includes(key));
    const allowed = unoccupied.length ? unoccupied : distinct.length ? distinct : currentBag;
    let index = currentBag.indexOf(allowed[0]);
    if (contactV4 && poseSelectionReady && allowed.length > 1 && firstFootPoses.size) {
      const currentFeet = readFeet();
      const mask = plantedFeet(currentFeet, restY, scale);
      const blocked = currentBag.filter(key => !allowed.includes(key));
      const best = contactV8 && firstSoles.size
        ? bestSupportCandidateV8(
            currentBag,firstSoles,initialSupports,readSoles(),
            contactV8Profiles.get(current)?.getContact(action.time)??mask,blocked,
          )
        : compatibleBagIndex(currentBag, firstFootPoses, currentFeet, mask, scale, blocked);
      if (best >= 0) index = best;
    }
    const next = currentBag.splice(Math.max(0, index), 1)[0];
    if (which === "base") bag = currentBag; else emoteBag = currentBag;
    return next;
  }
  // A single-clip owner review must be deterministic, never shuffle at boot.
  let current = clipReview ? available[0] : nextFrom(group.base, "base");
  poseSelectionReady = true;
  let lastBase = current;
  let baseCount = 0;
  let action = actions.get(current)!.reset().setEffectiveWeight(1).play();
  // Single-shot clip review: preserve the end pose and avoid loop-seam
  // snapping masquerading as foot sliding. Replay restarts from frame zero.
  let outgoing: THREE.AnimationAction | null = null;
  let previousActiveGesture:MixamoGesture|null = null;
  let fadeTime = 0;
  let queued: MixamoGesture | null = null;
  let isDisposed = false;
  const v8Stats:MixamoLobbyIdle["v8FootContact"] = {
    leftCm:0,rightCm:0,crossfadeLeftCm:0,crossfadeRightCm:0,
    segments:0,transitions:[],
  };
  const v8Last:([number,number,number]|null)[]=[null,null];
  let v8LastGesture:MixamoGesture|null=null;
  const placement: Placement = {
    feet: [[0, 0, 0, 0], [0, 0, 0, 0]],
    pitch: [0, 0], shift: 0, drop: 0,
  };
  function begin(next: MixamoGesture, immediate = false) {
    const incoming = actions.get(next);
    if (!incoming) return;
    const previousGesture=current;
    const currentContact:readonly [boolean,boolean] =
      contactV8Profiles.get(current)?.getContact(action.time) ??
      plantedFeet(readFeet(),restY,scale);
    const oldSoles=contactV8?readSoles():null;
    const nextSoles=firstSoles.get(next);
    const gaps:readonly [number,number]=oldSoles&&nextSoles
      ? [0,1].map(i=>Math.hypot(
          oldSoles[i][0]-nextSoles[i][0],
          oldSoles[i][2]-nextSoles[i][2],
        )*100) as [number,number]
      :[0,0];
    if (incoming === action) {
      action.reset().setEffectiveWeight(1).play();
      outgoing = null;
      previousActiveGesture=null;
      fadeTime = 0;
    } else {
      if (outgoing) outgoing.stop();
      // The previous 550ms fade could outlive the outgoing clip's 320ms lead.
      // Use the SAME duration for both the fade scheduler and the fade itself.
      const duration = contactV4
        ? transitionWindow(action.getClip().duration).fade
        : immediate ? 0.4 : Math.min(0.55, action.getClip().duration * 0.24);
      // A shorter capped crossfade reduces prolonged planted-foot blending
      // on mismatched support poses. We still blend all authored joints;
      // no runtime leg lock, transform warp, or extra AnimationMixer.
      const risk = Math.max(...gaps.filter((_,i)=>currentContact[i]));
      const baseFade = contactV4 && immediate ? Math.min(duration,0.22) : duration;
      const fade = contactV8 && risk>2.5
        ? Math.max(0.15,Math.min(baseFade,baseFade*0.82))
        : baseFade;
      incoming.reset().setEffectiveWeight(1).play();
      action.crossFadeTo(incoming, fade, false);
      outgoing = action;
      previousActiveGesture=current;
      fadeTime = fade;
      action = incoming;
    }
    const start = firstFootPoses.get(next);
    if (start) {
      const feet = readFeet();
      transitionPoseGap = supportFootMismatch(feet, start, plantedFeet(feet, restY, scale), scale);
    } else transitionPoseGap = 0;
    transitionCount++;
    if(contactV8){
      v8Stats.transitions.push({
        from:previousGesture,to:next,support:currentContact,
        soleGapCm:gaps,fadeSeconds:outgoing?fadeTime:0,
      });
      if(v8Stats.transitions.length>16)v8Stats.transitions.shift();
      v8Last[0]=v8Last[1]=null;
      v8LastGesture=null;
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
    head: "head",
    left_shoulder: "upper_arm.L", right_shoulder: "upper_arm.R", left_elbow: "lower_arm.L", right_elbow: "lower_arm.R",
    left_wrist: "hand.L", right_wrist: "hand.R", left_hip: "upper_leg.L", right_hip: "upper_leg.R",
    left_knee: "lower_leg.L", right_knee: "lower_leg.R", left_ankle: "foot.L", right_ankle: "foot.R",
  };
  const runtime: MixamoLobbyIdle = {
    instanceId: THREE.MathUtils.generateUUID(), playbackMixer: mixer,
    elapsedSeconds: 0, hasScratchPose: false, currentGesture: current,
    target: null, contacts: "DOUBLE_SUPPORT", phase: "MIXAMO_IDLE", floorError: 0,
    placement, random: !clipReview, completedGestures: 0, footDrift: 0, maxFootDrift: 0,
    lockedFeet: 0, maxContactError: 0, contactTravel: 0,
    plantedRawTravel: 0, plantedCorrectedTravel: 0,
    maxContactSlip: 0, maxCrossfadeSlip: 0,
    plantedContactTravel: 0, crossfadeContactTravel: 0,
    transitionPoseGap: 0, transitionCount: 0,
    sideStepEvents,
    sideStepV6Events,
    contactV7Reports,
    contactV8Reports,
    stationaryOnly,
    armStretchV10,
    greetingV11,
    armSleeveV10:sleeveV10?.metrics??null,
    allowedGestures:available,
    v8FootContact:v8Stats,
    animationProfile: current, clipDuration: action.getClip().duration, poseTime: 0,
    importReviewPack(text) {
      if(!clipReview || !reviewRetargeter || isDisposed)
        throw Error("Chỉ nạp animation trong demo một nhân vật");
      // Validate and build both clips before mutating the action catalog.
      const imported=reviewRetargeter(text);
      for(const item of imported){
        const old=actions.get(item.id);
        if(old){
          if(old===action) this.select(available[0]);
          old.stop();
          mixer.uncacheClip(old.getClip());
        }
        const next=mixer.clipAction(item.clip).setLoop(THREE.LoopOnce,1);
        next.clampWhenFinished=true;
        actions.set(item.id,next);
        if(!available.includes(item.id))available.push(item.id);
      }
      const ids=imported.map(x=>x.id);
      // Explicit source-only preview. No V7/V8 bake, hidden random, or foot lock.
      this.select(ids[0]);
      return ids;
    },
    select(id) {
      if (!actions.has(id as MixamoGesture)) return;
      this.random = false;
      if (clipReview) {
        // Independent full-clip playback, with NO crossfade or prior pose
        // blending. Changing clips never recreates the actor/mixer.
        mixer.stopAllAction();
        action = actions.get(id as MixamoGesture)!;
        action.reset().setLoop(THREE.LoopOnce,1);
        action.clampWhenFinished = true;
        action.setEffectiveWeight(1).play();
        outgoing = null;
        previousActiveGesture = null;
        fadeTime = 0;
        queued = null;
        current = id as MixamoGesture;
        this.currentGesture = current;
        this.animationProfile = current;
        this.clipDuration = action.getClip().duration;
        this.poseTime = 0;
        this.target = null;
        contactTracker.resetAnchors();
        v8Last[0] = v8Last[1] = null;
        v8LastGesture = null;
        mixer.update(0);
        return;
      }
      begin(id as MixamoGesture, true);
    },
    request(id) {
      if (clipReview) return;
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
          if (fadeTime <= 0) {
            outgoing.stop(); outgoing = null;
            previousActiveGesture=null; this.target = null;
          }
        }
        const duration = action.getClip().duration;
        const lead = contactV4 ? transitionWindow(duration).lead : Math.min(0.32, duration * 0.18);
        if (!clipReview && !outgoing && action.time >= duration - lead && (queued || this.random)) {
          const next = queued ?? drawNext();
          if (next) { this.completedGestures++; begin(next); }
        }
      }
      this.poseTime = action.time;
      this.clipDuration = action.getClip().duration;
      this.currentGesture = current;
      this.animationProfile = current;
      // Only the explicitly opted-in QA mode constrains planted ankles.
      // Run after Mixamo's mixer so authored upper body and steps stay intact.
      const lockSample = footLock?.update(deltaSeconds, Boolean(outgoing));
      this.lockedFeet = lockSample?.lockedFeet ?? 0;
      this.maxContactError = lockSample?.maxContactError ?? 0;
      this.contactTravel = lockSample?.contactTravel ?? 0;
      this.plantedRawTravel = lockSample?.plantedRawTravel ?? 0;
      this.plantedCorrectedTravel = lockSample?.plantedCorrectedTravel ?? 0;
      const rawFeet = readFeet();
      contactTracker.update(rawFeet, Boolean(outgoing), deltaSeconds);
      if(contactV8){
        const blended=Boolean(outgoing);
        const active=contactV8Profiles.get(current);
        const mask=active?.getContact(action.time)??[false,false];
        const was=outgoing
          ? (previousActiveGesture
            ? contactV8Profiles.get(previousActiveGesture)?.getContact(outgoing.time)
            :null)
          :null;
        const soles=readSoles();
        if(v8LastGesture!==current){
          v8Last[0]=v8Last[1]=null;
          v8LastGesture=current;
        }
        for(let i=0;i<2;i++){
          const planted=mask[i] && (!was||was[i]);
          if(!planted){v8Last[i]=null;continue;}
          if(v8Last[i]&&deltaSeconds>0&&deltaSeconds<=0.15){
            const cm=100*Math.hypot(soles[i][0]-v8Last[i]![0],
              soles[i][2]-v8Last[i]![2]);
            if(i===0){v8Stats.leftCm+=cm;if(blended)v8Stats.crossfadeLeftCm+=cm;}
            else {v8Stats.rightCm+=cm;if(blended)v8Stats.crossfadeRightCm+=cm;}
          }else v8Stats.segments++;
          v8Last[i]=[...soles[i]] as [number,number,number];
        }
      }
      this.maxContactSlip = contactTracker.stats.maxContactSlip;
      this.maxCrossfadeSlip = contactTracker.stats.maxCrossfadeSlip;
      this.plantedContactTravel = contactTracker.stats.plantedTravel;
      this.crossfadeContactTravel = contactTracker.stats.crossfadeTravel;
      this.transitionPoseGap = transitionPoseGap;
      this.transitionCount = transitionCount;
      const nextFeet = rawFeet.map((foot, i): Shoe => {
        const height = Math.max(0, foot[1] - rest[i].y);
        const horizontal = Math.hypot(foot[0] - rest[i].x, foot[2] - rest[i].z);
        if (height < 0.01) this.footDrift = Math.max(this.footDrift, horizontal);
        this.floorError = Math.max(this.floorError, rest[i].y - foot[1]);
        return [foot[0] / scale, foot[2] / scale, height / scale, 0];
      });
      this.maxFootDrift = Math.max(this.maxFootDrift, this.footDrift);
      this.placement.feet = nextFeet as [Shoe, Shoe];
      const v8Mask=contactV8Profiles.get(current)?.getContact(action.time);
      this.contacts = v8Mask
        ? v8Mask[0] && v8Mask[1] ? "DOUBLE_SUPPORT"
          : v8Mask[0] ? "LEFT_SUPPORT"
          : v8Mask[1] ? "RIGHT_SUPPORT" : "AIRBORNE"
        : nextFeet[0][2] > .01 ? "RIGHT_SUPPORT"
          : nextFeet[1][2] > .01 ? "LEFT_SUPPORT" : "DOUBLE_SUPPORT";
      this.phase = outgoing ? "CROSSFADE" : group.emote.includes(current) ? "MIXAMO_EMOTE" : "MIXAMO_IDLE";
      garmentFit?.update(nextFeet[1][2]);
      sleeveV10?.update(Math.max(
        current==="arm-stretching"?action.getEffectiveWeight():0,
        outgoing&&previousActiveGesture==="arm-stretching"
          ? outgoing.getEffectiveWeight():0,
      ));
    },
    seekReferenceTime(seconds) {
      action.time = THREE.MathUtils.clamp(seconds, 0, action.getClip().duration);
      mixer.update(0);
      contactTracker.resetAnchors(); // A manual seek is not a physical step.
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
      sleeveV10?.dispose();
      garmentFit?.dispose();
      mixer.stopAllAction();
      for (const item of actions.values()) mixer.uncacheClip(item.getClip());
      mixer.uncacheRoot(actor);
    },
  };
  // Ensure the first pose is authored, never standing in the rig's bind pose.
  mixer.update(0);
  return runtime;
}