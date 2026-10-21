import * as T from "three";
import type { ExitPolicy, PhraseSpec } from "./catalog";
import { calibrateForward, degrees, headingOf, HEADING_LIMITS, STAGE_FRONT, wrapAngle } from "./heading";
import type { FlarePlan } from "./flare-performance";

export type SourceMotion = { clip: T.AnimationClip; skeleton: T.Skeleton };
export type Pose = { root: T.Vector3; rotations: T.Quaternion[] };
type Sampler = { evaluate(t: number): ArrayLike<number> };
export type PreparedPhrase = {
  spec: PhraseSpec; duration: number; clip: T.AnimationClip;
  translation: Sampler; rotations: Sampler[]; path: T.Vector3[];
  sourceScale: number; floorReference: number; headings: number[];
  recoveryAlignment?: { yaw: number; leadInSeconds: number; mirrored: boolean; rootShiftLocalXZ: number[]; maxEntryFootAdjustment: number };
  flare?: FlarePlan;
};
export type CanonicalRig = { root: T.Bone; bones: T.Bone[]; names: string[]; scale: number };
type Playback = { phrase: PreparedPhrase; startBeat: number; offset: T.Vector3; yaw: number };
type Blend = { from: Playback | Pose; startBeat: number; durationBeats: number; headingDurationBeats: number };
export type TransitionRecord = {
  a: string | null; b: string; source: string; phrase: [number, number]; group: string;
  requestedBeat: number; visualStartBeat: number; delayBeats: number; policy: ExitPolicy;
  blendBeats: number; blendSeconds: number; entryDisplacement: number;
  before: number[]; after: number[]; afterBlend?: number[]; fadeTravelXZ?: number;
  interrupted?: boolean; stageAnchor: number[]; yaw: number; loopSeamWarning: string | null;
  headingBlendBeats: number;
  recoveryAlignment?: PreparedPhrase["recoveryAlignment"];
  flare?: FlarePlan;
  orientation: { outgoingHeadingDeg: number; incomingHeadingDeg: number; headingDeltaDeg: number; desiredHeadingDeg: number; maxPhraseFacingErrorDeg: number; predictedMaxYawDegPerSecond: number; predictedMaxQuaternionDegPerSecond: number; measuredMaxYawDegPerSecond: number; measuredMaxQuaternionDegPerSecond: number; policy: string };
};
export type PlacementDecision = { id: string; beat: number; rootXZ: number[]; evaluated: number; spatialRejected: number; continuationRejected: number; facingRejected: number; angularRejected: number; accepted: number; reason: string; selectedYawDeg: number | null };
type Placement = { yaw: number; score: number; maxFacingError: number; maxYawSpeed: number; maxQuaternionSpeed: number };

const Y = new T.Vector3(0, 1, 0);
const clamp = T.MathUtils.clamp;
const clonePose = (p: Pose): Pose => ({ root: p.root.clone(), rotations: p.rotations.map(q => q.clone()) });
const interpolate = (a: Pose, b: Pose, t: number): Pose => ({
  root: a.root.clone().lerp(b.root, t), rotations: a.rotations.map((q, i) => q.clone().slerp(b.rotations[i], t)),
});
const smooth = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
export function rootYaw(q: T.Quaternion) {
  return headingOf(q);
}
const interpolant = (track: T.KeyframeTrack): Sampler => {
  // createInterpolant is supplied by the concrete track type at runtime.
  return (track as T.KeyframeTrack & { createInterpolant(): Sampler }).createInterpolant();
};
function track(source: SourceMotion, name: string) {
  const t = source.clip.tracks.find(t => t.name === name);
  if (!t) throw new Error(`Thiếu track ${name}.`);
  return t;
}

export function makeCanonicalRig(source: SourceMotion): CanonicalRig {
  const root = source.skeleton.bones[0].clone(true);
  const bones: T.Bone[] = [];
  root.traverse(o => { if ((o as T.Bone).isBone) bones.push(o as T.Bone); });
  const q = new Map(source.clip.tracks.filter(t => t.name.endsWith(".quaternion")).map(t => [t.name, interpolant(t)]));
  for (const b of bones) { const s = q.get(b.name + ".quaternion"); if (s) b.quaternion.fromArray(s.evaluate(0.6)); }
  root.position.set(0, 0, 0); root.updateMatrixWorld(true);
  const box = new T.Box3(); for (const b of bones) box.expandByPoint(b.getWorldPosition(new T.Vector3()));
  const scale = 1.65 / Math.max(box.max.y - box.min.y, 1);
  // Positions belong to one canonical CMU rig and never animate/bend in length.
  for (const b of bones) { b.position.multiplyScalar(scale); b.quaternion.identity(); }
  root.position.set(0, 0, 0); root.updateMatrixWorld(true);
  return { root, bones, names: bones.map(b => b.name), scale };
}

function legLength(source: SourceMotion) {
  return ["LeftUpLeg", "LeftLeg", "LeftFoot"].reduce((n, name) => {
    const bone = source.skeleton.bones.find(b => b.name === name);
    if (!bone) throw new Error("Hierarchy BVH không tương thích.");
    return n + bone.position.length();
  }, 0);
}

export function preparePhrase(spec: PhraseSpec, source: SourceMotion, canonical: CanonicalRig, canonicalSource: SourceMotion): PreparedPhrase {
  if (!(spec.end > spec.start) || spec.end > source.clip.duration + 1 / 120) throw new Error(`Window không hợp lệ: ${spec.id}`);
  const sourceNames = source.skeleton.bones.map(b => b.name);
  if (JSON.stringify(sourceNames) !== JSON.stringify(canonical.names)) throw new Error("Hierarchy BVH khác canonical rig.");
  const position = interpolant(track(source, "Hips.position"));
  const qs = canonical.names.map(name => {
    const t = source.clip.tracks.find(t => t.name === name + ".quaternion");
    return t ? interpolant(t) : null;
  });
  const entry = new T.Vector3().fromArray(position.evaluate(spec.start));
  const rootEntry = new T.Quaternion().fromArray(qs[0]!.evaluate(spec.start));
  const inverseYaw = new T.Quaternion().setFromAxisAngle(Y, -rootYaw(rootEntry));
  const sourceScale = canonical.scale * legLength(canonicalSource) / legLength(source);
  const duration = Math.min(spec.end, source.clip.duration) - spec.start;
  const times: number[] = [], roots: number[] = [];
  const quaternionValues = canonical.names.map(() => [] as number[]);
  const path: T.Vector3[] = [];
  const frames = Math.ceil(duration * 60);
  const previous: (T.Quaternion | null)[] = canonical.names.map(() => null);
  let floorReference = 0;
  const scratch = canonical.root.clone(true); const scratchBones: T.Bone[] = [];
  scratch.traverse(o => { if ((o as T.Bone).isBone) scratchBones.push(o as T.Bone); });
  for (let frame = 0; frame <= frames; frame++) {
    const t = frame === frames ? duration : frame / 60;
    const p = new T.Vector3().fromArray(position.evaluate(spec.start + t)).sub(entry).multiplyScalar(sourceScale).applyQuaternion(inverseYaw);
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i] ? new T.Quaternion().fromArray(qs[i]!.evaluate(spec.start + t)) : new T.Quaternion();
      if (i === 0) q.premultiply(inverseYaw);
      q.normalize(); if (previous[i] && previous[i]!.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      previous[i] = q.clone(); scratchBones[i].quaternion.copy(q); quaternionValues[i].push(...q.toArray());
    }
    scratch.updateMatrixWorld(true);
    // Retain captured Y motion, including jumps/inversions. Correct only ground
    // penetration caused by canonical proportions. This is not contact IK.
    let minimumY = Infinity;
    for (const bone of scratchBones) minimumY = Math.min(minimumY, bone.getWorldPosition(new T.Vector3()).y);
    if (frame === 0) floorReference = -minimumY;
    p.y += floorReference; p.y = Math.max(p.y, -minimumY);
    times.push(t); roots.push(...p.toArray()); path.push(p.clone());
  }
  const rootTrack = new T.VectorKeyframeTrack("motionRoot.position", times, roots);
  const tracks: T.KeyframeTrack[] = [rootTrack, ...canonical.names.map((name, i) => new T.QuaternionKeyframeTrack(name + ".quaternion", times, quaternionValues[i]))];
  const clip = new T.AnimationClip(spec.id, duration, tracks);
  const headings: number[] = [];
  for (let i = 0; i < times.length; i++) {
    const yaw = rootYaw(new T.Quaternion().fromArray(quaternionValues[0], i * 4));
    headings.push(i === 0 ? yaw : headings[i - 1] + wrapAngle(yaw - headings[i - 1]));
  }
  return { spec, duration, clip, translation: interpolant(rootTrack), rotations: tracks.slice(1).map(interpolant), path, sourceScale, floorReference, headings };
}

export function safeExitTime(spec: PhraseSpec, localSeconds: number, duration: number, override?: ExitPolicy) {
  const inside = spec.protectedRanges?.find(([a, b]) => localSeconds >= a && localSeconds < b);
  // A UI override may make an upright phrase stricter, never bypass true contact protection.
  const policy = inside ? "PROTECTED" : override ?? spec.policy;
  if (policy === "FREE") return { localSeconds, policy: policy as ExitPolicy };
  const earliest = inside ? inside[1] : localSeconds;
  const exit = spec.exitMarkers.find(t => t >= earliest - 1e-7) ?? duration;
  return { localSeconds: Math.max(localSeconds, Math.min(exit, duration)), policy: policy as ExitPolicy };
}

export class SourceFlowEngine {
  readonly stageAnchor = new T.Group();
  readonly motionRoot = new T.Group();
  readonly rigRoot = new T.Group();
  readonly history: TransitionRecord[] = [];
  readonly radius = 1.35;
  current: Playback | null = null;
  pending: { id: string; requestedBeat: number; dueBeat: number; policy: ExitPolicy; blendBeats?: number } | null = null;
  blendBeats = 0.35;
  /** Gameplay-only living idle. Free Animation Lab retains one-shot behavior. */
  loopIdle = false;
  bpm = 120;
  policyOverride: ExitPolicy | undefined;
  private blend: Blend | null = null;
  private pose: Pose;
  private latestBeat = 0;
  private lastRecord: TransitionRecord | null = null;
  private startedAt = new T.Vector3();
  private previousRoot = new T.Vector3();
  pathLength = 0;
  maxRadius = 0;
  maxFrameStep = 0;
  rejectedRequests = 0;
  readonly forwardCalibration;
  readonly desiredHeading = STAGE_FRONT;
  readonly placementDecisions = new Map<string, PlacementDecision>();
  private orientationBeat: number | null = null;
  private orientationQuaternion = new T.Quaternion();
  private continuousHeading = 0;
  maxFacingDeviationDeg = 0;
  maxTransitionYawDegPerSecond = 0;
  maxTransitionQuaternionDegPerSecond = 0;

  constructor(readonly rig: CanonicalRig, readonly phrases: Map<string, PreparedPhrase>) {
    this.forwardCalibration = calibrateForward(rig.root, rig.bones);
    this.stageAnchor.name = "QA-V2-stable-stage-anchor";
    this.motionRoot.name = "QA-V2-localized-motion-root";
    this.rigRoot.name = "QA-V2-canonical-CMU-rig";
    this.stageAnchor.add(this.motionRoot); this.motionRoot.add(this.rigRoot); this.rigRoot.add(rig.root);
    this.pose = { root: new T.Vector3(), rotations: rig.bones.map(() => new T.Quaternion()) };
  }
  private time(p: Playback, beat: number) {
    const elapsed = Math.max(0, (beat - p.startBeat) * 60 / p.phrase.spec.referenceBpm);
    // Only the authored, seam-closed rest-standing tail loops in Gameplay Preview.
    // Never loop an ordinary dance, protected motion, or the Flare composite.
    if (this.loopIdle && p.phrase.spec.role === "idle" && p.phrase.duration > 0)
      return elapsed % p.phrase.duration;
    return clamp(elapsed, 0, p.phrase.duration);
  }
  private sample(p: Playback, beat: number): Pose {
    const t = this.time(p, beat), yaw = new T.Quaternion().setFromAxisAngle(Y, p.yaw);
    const root = new T.Vector3().fromArray(p.phrase.translation.evaluate(t)).applyQuaternion(yaw);
    root.x += p.offset.x; root.z += p.offset.z;
    return { root, rotations: p.phrase.rotations.map((s, i) => {
      const q = new T.Quaternion().fromArray(s.evaluate(t)); return i === 0 ? q.premultiply(yaw) : q;
    }) };
  }
  /** Test the ENTIRE path, not just its endpoint. Convex blends stay inside the same disc. */
  placement(id: string, at = this.pose.root, heading = rootYaw(this.pose.rotations[0])) {
    const phrase = this.phrases.get(id); if (!phrase) return null;
    const fixture = phrase.spec.role === "fixture";
    const decision: PlacementDecision = { id, beat: this.latestBeat, rootXZ: [at.x, at.z], evaluated: 0, spatialRejected: 0, continuationRejected: 0, facingRejected: 0, angularRejected: 0, accepted: 0, reason: "", selectedYawDeg: null };
    const center = (Math.min(...phrase.headings) + Math.max(...phrase.headings)) / 2;
    const candidates = phrase.flare ? [phrase.flare.yaw] : phrase.recoveryAlignment ? [phrase.recoveryAlignment.yaw] : phrase.spec.role === "idle" ? [heading - phrase.headings[0]] : fixture ? Array.from({length: 48}, (_, i) => heading + i * Math.PI / 24) : [heading - phrase.headings[0], this.desiredHeading - center, ...Array.from({length: 48}, (_, i) => this.desiredHeading + i * Math.PI / 24)];
    let best: Placement | null = null;
    for (const yaw of candidates) {
      decision.evaluated++;
      const q = new T.Quaternion().setFromAxisAngle(Y, yaw);
      let peak = 0, end = 0;
      for (const p of phrase.path) {
        const v = p.clone().applyQuaternion(q); const r = Math.hypot(v.x + at.x, v.z + at.z);
        peak = Math.max(peak, r); end = r;
      }
      if (peak > this.radius - 0.005) { decision.spatialRejected++; continue; }
      const boundaryPoint = new T.Vector3().fromArray(phrase.translation.evaluate(Math.min(phrase.duration, 4 * 60 / phrase.spec.referenceBpm))).applyQuaternion(q);
      const boundaryRadius = Math.hypot(boundaryPoint.x + at.x, boundaryPoint.z + at.z);
      // Reserve recovery space even if a rejected SPACE lets this one-shot run
      // to its end. Boundary-only checking stranded browser seed 315885701.
      if (!fixture && !phrase.flare && phrase.spec.role !== "recovery" && phrase.spec.role !== "idle" && this.current && Math.max(boundaryRadius, end) > Math.max(1.05, Math.hypot(at.x, at.z) - 0.1)) { decision.continuationRejected++; continue; }
      const boundaryHeading = phrase.headings[Math.min(phrase.headings.length - 1, Math.round(4 * 60 / phrase.spec.referenceBpm * 60))] + yaw;
      const exitFacing = Math.abs(wrapAngle(boundaryHeading - this.desiredHeading));
      const errors = phrase.headings.map(h => Math.abs(wrapAngle(h + yaw - this.desiredHeading)));
      const maxFacingError = degrees(Math.max(...errors));
      const entryError = degrees(errors[0]);
      // Standing inherits the actual heading (zero introduced yaw), rather than
      // pivoting planted feet solely to re-enter the upright entry cone.
      const entryLimit = phrase.spec.role === "idle" ? HEADING_LIMITS.phraseDeg : HEADING_LIMITS.entryDeg;
      // An explicitly calibrated power move has authored inversion/roll. Hips
      // projected yaw there is not anatomical upright facing. Entry/exit are
      // baked from/to standing, with zero placement-introduced heading.
      // 85_04 is an explicitly PROTECTED owner-selected Finish with full-body
      // turns/rolls. Hips +Z is NOT an anatomical front during those spins.
      // Preserve the strict entry facing and re-entry cone at its grounded
      // exit, but do not reject the protected middle as an ordinary upright
      // Street phrase. All stage-radius and initial transition yaw checks
      // remain authoritative. No bypass for CORE/SPACE or old Finishes.
      const protectedFancyFinish = phrase.spec.id === "finish-85-04"
        && phrase.spec.role === "finish" && phrase.spec.policy === "PROTECTED";
      // This protected floor-spinning Finish's non-upright dismount Hips yaw
      // is NOT a reliable audience-facing measure; the dynamic recovery is
      // responsible for returning to an upright facing. Keep strict ENTRY
      // facing, introduced angular change, entire root path and stage limits.
      // All other Finish/CORE/SPACE rules stay untouched.
      if (!fixture && !phrase.flare
        && (entryError > entryLimit
          || (!protectedFancyFinish && maxFacingError > HEADING_LIMITS.phraseDeg))) {
        decision.facingRejected++; continue;
      }
      const angle = Math.abs(wrapAngle(yaw + phrase.headings[0] - heading));
      // Bound the rotation INTRODUCED by placement separately from authored twists.
      // Larger entry changes require a different phrase, never a hidden 180° spin.
      if (!fixture && this.current && degrees(angle) > HEADING_LIMITS.transitionHeadingDeltaDeg) { decision.angularRejected++; continue; }
      const velocity = fixture || !this.current ? { maxYawSpeed: 0, maxQuaternionSpeed: 0 } : this.predictRotation(phrase, yaw);
      decision.accepted++;
      const rms = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
      const score = fixture ? peak + end * 1.5 + angle * 0.045 : rms * 2 + exitFacing * 3 + angle * 0.3 + peak + end + boundaryRadius * 2;
      if (!best || score < best.score) best = { yaw, score, maxFacingError, ...velocity };
    }
    decision.selectedYawDeg = best ? degrees(wrapAngle(best.yaw)) : null;
    decision.reason = best ? fixture ? "fixture-spatial-only" : "spatial-facing-angular-compatible" : decision.spatialRejected === decision.evaluated ? "stage-radius" : decision.angularRejected ? "transition-heading-delta" : decision.facingRejected ? "phrase-facing" : "continuation-space";
    this.placementDecisions.set(id, decision);
    return best;
  }
  private rootRotation(p: Playback, beat: number) {
    return new T.Quaternion().fromArray(p.phrase.rotations[0].evaluate(this.time(p, beat))).premultiply(new T.Quaternion().setFromAxisAngle(Y, p.yaw));
  }
  private headingBlendDuration(phrase: PreparedPhrase, yaw: number, fade = this.blendBeats) {
    if (phrase.spec.role === "fixture") return this.blendBeats;
    const delta = degrees(Math.abs(wrapAngle(yaw + phrase.headings[0] - rootYaw(this.pose.rotations[0]))));
    // Only root quaternion may outlast requested pose/XZ fade. This bounds the
    // entry-offset contribution, NOT the authored source twist velocity. Reserve
    // 180 BPM so changing tempo within the supported UI range cannot reset it.
    return Math.max(fade, 1.5 * delta / HEADING_LIMITS.transitionAddedYawDegPerSecond * Math.max(180, this.bpm) / 60);
  }
  private predictRotation(phrase: PreparedPhrase, yaw: number) {
    // Reserve the full supported UI tempo range, including a BPM change mid-fade.
    const duration = Math.max(this.headingBlendDuration(phrase, yaw), 1e-6), seconds = duration * 60 / Math.max(180, this.bpm);
    const steps = Math.max(16, Math.ceil(seconds * 240));
    const incoming = { phrase, yaw, offset: this.pose.root, startBeat: this.latestBeat };
    let previous = this.pose.rotations[0], maxYawSpeed = 0, maxQuaternionSpeed = 0;
    for (let i = 1; i <= steps; i++) {
      const beat = this.latestBeat + duration * i / steps;
      const outgoing = this.blend || !this.current ? this.pose.rotations[0].clone() : this.rootRotation(this.current, beat);
      const q = outgoing.slerp(this.rootRotation(incoming, beat), smooth(i / steps));
      maxYawSpeed = Math.max(maxYawSpeed, degrees(Math.abs(wrapAngle(rootYaw(q) - rootYaw(previous)))) / (seconds / steps));
      maxQuaternionSpeed = Math.max(maxQuaternionSpeed, degrees(previous.angleTo(q)) / (seconds / steps)); previous = q;
    }
    return { maxYawSpeed, maxQuaternionSpeed };
  }
  start(id: string, beat = 0) {
    this.latestBeat = beat; this.pose.root.set(0, 0, 0);
    this.current = null; this.blend = null; this.pending = null; this.history.length = 0;
    this.lastRecord = null;
    this.pathLength = 0; this.maxRadius = 0; this.maxFrameStep = 0; this.rejectedRequests = 0;
    this.pose.rotations = this.rig.bones.map(() => new T.Quaternion());
    this.orientationBeat = null; this.continuousHeading = 0; this.maxFacingDeviationDeg = 0;
    this.maxTransitionYawDegPerSecond = 0; this.maxTransitionQuaternionDegPerSecond = 0; this.placementDecisions.clear();
    if (!this.commit(id, beat, beat, "FREE", true)) throw new Error("Phrase không vừa vùng sân.");
    this.update(beat); this.startedAt.copy(this.pose.root); this.previousRoot.copy(this.pose.root);
  }
  request(id: string, beat: number, fade?: number, immediateGameplay = false) {
    this.update(beat);
    if (!this.current) return this.commit(id, beat, beat, "FREE");
    const time = this.time(this.current, beat);
    const outgoing = this.current.phrase.spec;
    const incomingRole = this.phrases.get(id)?.spec.role;
    const protectedNow = outgoing.protectedRanges?.some(([start, end]) => time >= start && time < end) ?? false;
    // A successful normal SPACE owns its visual start time. This policy is
    // explicitly opted into by Gameplay Preview; protected/Flare/fixture paths
    // and Free Animation Lab keep their authored safe-exit contract.
    const direct = immediateGameplay && !protectedNow
      && (outgoing.role === "core" || outgoing.role === "idle")
      && (incomingRole === "core" || incomingRole === "idle"
        || (incomingRole === "finish" && (Boolean(this.phrases.get(id)?.flare) || id === "finish-85-04")));
    const exit = direct ? { localSeconds: time, policy: "FREE" as ExitPolicy }
      : safeExitTime(outgoing, time, this.current.phrase.duration, this.policyOverride);
    const dueBeat = beat + (exit.localSeconds - time) * this.current.phrase.spec.referenceBpm / 60;
    if (dueBeat > beat + 1e-6) {
      // Coalesce repeated SPACE, but retain the first recovery deadline. A later
      // request can replace the target; it cannot postpone the exit forever.
      this.pending = { id, requestedBeat: beat, dueBeat: this.pending?.dueBeat ?? dueBeat, policy: exit.policy, blendBeats: fade };
      return true;
    }
    this.pending = null; return this.commit(id, beat, beat, exit.policy, false, fade);
  }
  /** Read-only recovery pose for expanded-pool selection; V2.1 scoring is unchanged. */
  private exitPose(beat: number) {
    if (!this.current) return { pose: clonePose(this.pose), due: beat };
    const time = this.time(this.current, beat);
    const exit = safeExitTime(this.current.phrase.spec, time, this.current.phrase.duration, this.policyOverride);
    const due = this.pending?.dueBeat ?? beat + (exit.localSeconds - time) * this.current.phrase.spec.referenceBpm / 60;
    let pose = this.sample(this.current, due);
    if (this.blend) {
      const from = "phrase" in this.blend.from ? this.sample(this.blend.from, due) : this.blend.from;
      const rotation = from.rotations[0].clone().slerp(pose.rotations[0], smooth((due - this.blend.startBeat) / this.blend.headingDurationBeats));
      pose = interpolate(from, pose, smooth((due - this.blend.startBeat) / this.blend.durationBeats)); pose.rotations[0] = rotation;
    }
    return { pose, due };
  }
  displayedAtExit(beat: number, immediateGameplay = false) {
    if (immediateGameplay && this.current
      && (this.current.phrase.spec.role === "core" || this.current.phrase.spec.role === "idle")
      && !(this.current.phrase.spec.protectedRanges?.some(([a, b]) => {
        const t = this.time(this.current!, beat); return t >= a && t < b;
      }) ?? false)) {
      this.update(beat);
      return { pose: clonePose(this.pose), due: beat };
    }
    const out = this.exitPose(beat);
    return { pose: clonePose(out.pose), due: out.due };
  }
  placementAtExit(id: string, beat: number, immediateGameplay = false) {
    if (immediateGameplay && this.current
      && (this.current.phrase.spec.role === "core" || this.current.phrase.spec.role === "idle")) {
      this.update(beat);
      return this.placement(id); // Evaluate the actually displayed SPACE pose.
    }
    const { pose } = this.exitPose(beat);
    return this.placement(id, pose.root, rootYaw(pose.rotations[0]));
  }
  /** Check one known upcoming Finish without moving the dancer or gameplay clock. */
  canFollowAt(id: string, nextIds: readonly string[], beat: number, nextBeat: number, recovery?: Readonly<Record<string, string>>) {
    const { pose, due } = this.exitPose(beat), phrase = this.phrases.get(id);
    const place = this.placement(id, pose.root, rootYaw(pose.rotations[0]));
    if (!phrase || !place) return false;
    const incoming = { phrase, startBeat: due, offset: pose.root, yaw: place.yaw };
    const time = this.time(incoming, nextBeat);
    const exit = safeExitTime(phrase.spec, time, phrase.duration, this.policyOverride);
    const target = this.sample(incoming, nextBeat + (exit.localSeconds - time) * phrase.spec.referenceBpm / 60);
    return nextIds.some(next => {
      const nextPlace = this.placement(next, target.root, rootYaw(target.rotations[0]));
      if (!nextPlace) return false;
      if (!recovery?.[next]) return true;
      const nextPhrase = this.phrases.get(next)!;
      const end = this.sample({ phrase: nextPhrase, startBeat: 0, offset: target.root, yaw: nextPlace.yaw }, nextPhrase.duration * nextPhrase.spec.referenceBpm / 60);
      return Boolean(this.placement(recovery[next], end.root, rootYaw(end.rotations[0])));
    });
  }
  canFollowAtEnd(id: string, nextIds: readonly string[], beat: number) {
    const { due } = this.exitPose(beat), phrase = this.phrases.get(id);
    return Boolean(phrase && this.canFollowAt(id, nextIds, beat, due + phrase.duration * phrase.spec.referenceBpm / 60));
  }
  nextExitDelayAt(id: string, beat: number, nextBeat: number) {
    const { due } = this.exitPose(beat), phrase = this.phrases.get(id);
    if (!phrase) return Infinity;
    const time = clamp((nextBeat - due) * 60 / phrase.spec.referenceBpm, 0, phrase.duration);
    const exit = safeExitTime(phrase.spec, time, phrase.duration, this.policyOverride);
    return (exit.localSeconds - time) * phrase.spec.referenceBpm / 60;
  }
  private commit(id: string, beat: number, requestedBeat: number, policy: ExitPolicy, initial = false, fade = this.blendBeats) {
    const phrase = this.phrases.get(id); const place = this.placement(id);
    if (!phrase || !place) { this.rejectedRequests++; return false; }
    const before = clonePose(this.pose), previous = this.current;
    if (this.lastRecord && this.blend) this.lastRecord.interrupted = true;
    const from = this.blend ? before : previous;
    this.current = { phrase, startBeat: beat, offset: before.root.clone(), yaw: place.yaw };
    const entry = this.sample(this.current, beat);
    // A .35-beat fade at 200 BPM is 105ms: enough for a mathematical
    // quaternion interpolation, but visibly snaps between unrelated
    // full-body dance poses. Make CORE SPACE fades pose-sensitive in
    // presentation time only. Never delay the SPACE/turn/clip start, and
    // never modify protected Finish/Flare or recovery transitions.
    const ordinaryDanceHandoff = !initial
      && phrase.spec.role === "core"
      && (previous?.phrase.spec.role === "core" || previous?.phrase.spec.role === "idle");
    const jointAngles = ordinaryDanceHandoff
      ? before.rotations.slice(1).map((q, i) => q.angleTo(entry.rotations[i + 1]))
        .filter(Number.isFinite).sort((a, b) => a - b) : [];
    const p75 = jointAngles.length
      ? jointAngles[Math.floor((jointAngles.length - 1) * .75)] : 0;
    const minFadeSeconds = ordinaryDanceHandoff
      ? T.MathUtils.clamp(.14 + p75 * .075, .14, .245) : 0;
    const effectiveFadeBeats = ordinaryDanceHandoff
      ? Math.max(fade, Math.min(.9, minFadeSeconds * this.bpm / 60)) : fade;
    this.blend = initial || !from ? null : {
      from, startBeat: beat, durationBeats: effectiveFadeBeats,
      headingDurationBeats: this.headingBlendDuration(phrase, place.yaw, effectiveFadeBeats)
    };
    const record: TransitionRecord = {
      a: previous?.phrase.spec.id ?? null, b: id, source: phrase.spec.source,
      phrase: [phrase.spec.start, phrase.spec.end], group: phrase.spec.group,
      requestedBeat, visualStartBeat: beat, delayBeats: beat - requestedBeat, policy,
      blendBeats: this.blend?.durationBeats ?? 0, blendSeconds: (this.blend?.durationBeats ?? 0) * 60 / this.bpm,
      headingBlendBeats: this.blend?.headingDurationBeats ?? 0,
      ...(phrase.recoveryAlignment ? { recoveryAlignment: phrase.recoveryAlignment } : {}),
      ...(phrase.flare ? { flare: phrase.flare } : {}),
      entryDisplacement: Math.hypot(entry.root.x - before.root.x, entry.root.z - before.root.z),
      before: before.root.toArray(), after: initial ? entry.root.toArray() : before.root.toArray(),
      stageAnchor: this.stageAnchor.position.toArray(), yaw: place.yaw, loopSeamWarning: null,
      orientation: { outgoingHeadingDeg: degrees(rootYaw(before.rotations[0])), incomingHeadingDeg: degrees(rootYaw(entry.rotations[0])), headingDeltaDeg: degrees(wrapAngle(rootYaw(entry.rotations[0]) - rootYaw(before.rotations[0]))), desiredHeadingDeg: degrees(this.desiredHeading), maxPhraseFacingErrorDeg: place.maxFacingError, predictedMaxYawDegPerSecond: place.maxYawSpeed, predictedMaxQuaternionDegPerSecond: place.maxQuaternionSpeed, measuredMaxYawDegPerSecond: 0, measuredMaxQuaternionDegPerSecond: 0, policy: phrase.spec.role === "fixture" ? "fixture-spatial-only" : "audience-biased" },
    };
    this.history.push(record); this.lastRecord = record;
    this.apply(initial ? entry : before); return true;
  }
  update(beat: number) {
    if (!this.current) return;
    if (this.pending && beat >= this.pending.dueBeat - 1e-7) {
      const request = this.pending; this.pending = null;
      // Evaluate the actual displayed blend at recovery before committing, not
      // the unblended outgoing clip or a pose from the later catch-up frame.
      this.update(request.dueBeat);
      this.commit(request.id, request.dueBeat, request.requestedBeat, request.policy, false, request.blendBeats);
    }
    this.latestBeat = beat;
    const transitioning = Boolean(this.blend);
    let pose = this.sample(this.current, beat);
    if (this.blend) {
      const alpha = (beat - this.blend.startBeat) / this.blend.durationBeats;
      const from = "phrase" in this.blend.from ? this.sample(this.blend.from, beat) : this.blend.from;
      const headingAlpha = (beat - this.blend.startBeat) / this.blend.headingDurationBeats;
      const rootRotation = from.rotations[0].clone().slerp(pose.rotations[0], smooth(headingAlpha));
      pose = interpolate(from, pose, smooth(alpha)); pose.rotations[0] = rootRotation;
      if (alpha >= 1 && this.lastRecord && !this.lastRecord.afterBlend) { this.lastRecord.afterBlend = pose.root.toArray(); this.lastRecord.fadeTravelXZ = Math.hypot(pose.root.x - this.lastRecord.before[0], pose.root.z - this.lastRecord.before[2]); }
      if (alpha >= 1 && headingAlpha >= 1) this.blend = null;
    }
    this.apply(pose);
    this.observeOrientation(beat, transitioning);
  }
  private observeOrientation(beat: number, transitioning: boolean) {
    const heading = rootYaw(this.pose.rotations[0]);
    this.maxFacingDeviationDeg = Math.max(this.maxFacingDeviationDeg, degrees(Math.abs(wrapAngle(heading - this.desiredHeading))));
    if (this.orientationBeat === null) this.continuousHeading = heading;
    else if (beat > this.orientationBeat + 1e-9) {
      const delta = wrapAngle(heading - rootYaw(this.orientationQuaternion));
      this.continuousHeading += delta;
      if (transitioning) {
        const dt = (beat - this.orientationBeat) * 60 / this.bpm;
        const yawSpeed = degrees(Math.abs(delta)) / dt;
        const quaternionSpeed = degrees(this.orientationQuaternion.angleTo(this.pose.rotations[0])) / dt;
        this.maxTransitionYawDegPerSecond = Math.max(this.maxTransitionYawDegPerSecond, yawSpeed);
        this.maxTransitionQuaternionDegPerSecond = Math.max(this.maxTransitionQuaternionDegPerSecond, quaternionSpeed);
        if (this.lastRecord) {
          this.lastRecord.orientation.measuredMaxYawDegPerSecond = Math.max(this.lastRecord.orientation.measuredMaxYawDegPerSecond, yawSpeed);
          this.lastRecord.orientation.measuredMaxQuaternionDegPerSecond = Math.max(this.lastRecord.orientation.measuredMaxQuaternionDegPerSecond, quaternionSpeed);
        }
      }
    }
    this.orientationBeat = beat; this.orientationQuaternion.copy(this.pose.rotations[0]);
  }
  private apply(pose: Pose) {
    const step = Math.hypot(pose.root.x - this.pose.root.x, pose.root.z - this.pose.root.z);
    this.maxFrameStep = Math.max(this.maxFrameStep, step);
    this.pathLength += step; this.previousRoot.copy(this.pose.root);
    this.pose = pose; this.motionRoot.position.copy(pose.root);
    this.rig.bones.forEach((b, i) => b.quaternion.copy(pose.rotations[i]));
    this.stageAnchor.updateMatrixWorld(true);
    // Dedicated recovery/standing presentation: blended proportions must not
    // push a foot below the demo floor. XZ and all authored rotations stay intact.
    const fromRest = this.blend && "phrase" in this.blend.from && ["recovery", "idle"].includes(this.blend.from.phrase.spec.role);
    if (this.current?.phrase.flare || this.current?.phrase.spec.role === "recovery" || this.current?.phrase.spec.role === "idle" || fromRest) {
      let minimum = 0;
      for (const bone of this.rig.bones) minimum = Math.min(minimum, bone.getWorldPosition(new T.Vector3()).y);
      if (minimum < 0) { this.pose.root.y -= minimum; this.motionRoot.position.y = this.pose.root.y; this.stageAnchor.updateMatrixWorld(true); }
    }
    this.maxRadius = Math.max(this.maxRadius, Math.hypot(pose.root.x, pose.root.z));
  }
  snapshot() {
    const current = this.current, time = current ? this.time(current, this.latestBeat) : 0,flare=current?.phrase.flare;
    const inFlareLoop=flare&&time>=flare.entrySeconds&&time<flare.entrySeconds+flare.loopSeconds;
    return {
      current: current?.phrase.spec.id ?? null, previous: this.history.at(-1)?.a ?? null,
      source: current?.phrase.spec.source ?? null, sourcePhrase: flare?[0,1]:current ? [current.phrase.spec.start, current.phrase.spec.end] : null,
      sourceTime: flare?inFlareLoop?(flare.phaseOffset+(time-flare.entrySeconds)*flare.playbackRate)%1:0:current ? current.phrase.spec.start + Math.max(0, time - (current.phrase.recoveryAlignment?.leadInSeconds ?? 0)) : 0,
      samplingDomain:flare?{kind:'composite-Flare-performance',performanceSeconds:time,importedLoopActive:Boolean(inFlareLoop),importedDurationSeconds:1,entryDismountSource:'CMU85_03 18–18.7s + experimental contact bridge'}:null,
      root: this.pose.root.toArray(), stageAnchor: this.stageAnchor.position.toArray(),
      entryDisplacement: this.history.at(-1)?.entryDisplacement ?? 0,
      cumulativeDisplacement: Math.hypot(this.pose.root.x - this.startedAt.x, this.pose.root.z - this.startedAt.z),
      pathLength: this.pathLength, maxRadius: this.maxRadius, maxFrameStep: this.maxFrameStep,
      pending: this.pending, blendProgress: this.blend ? clamp((this.latestBeat - this.blend.startBeat) / this.blend.durationBeats, 0, 1) : 1,
      policy: this.pending?.policy ?? current?.phrase.spec.policy ?? "FREE",
      heldAtEnd: Boolean(current && time >= current.phrase.duration),
      loopSeamWarning: null, rejectedRequests: this.rejectedRequests,
      transitionCount: Math.max(0, this.history.length - 1),
      orientation: {
        calibration: this.forwardCalibration, headingWrappedDeg: degrees(rootYaw(this.pose.rotations[0])),
        headingUnwrappedSampledDeg: degrees(this.continuousHeading), desiredHeadingDeg: degrees(this.desiredHeading),
        facingErrorDeg: degrees(wrapAngle(rootYaw(this.pose.rotations[0]) - this.desiredHeading)),
        maxFacingDeviationDeg: this.maxFacingDeviationDeg,
        maxTransitionYawDegPerSecond: this.maxTransitionYawDegPerSecond,
        maxTransitionQuaternionDegPerSecond: this.maxTransitionQuaternionDegPerSecond,
        sourceYawRangeUnwrappedDeg: current ? [degrees(Math.min(...current.phrase.headings)), degrees(Math.max(...current.phrase.headings))] : null,
        policy: flare?'authored-power-move; upright-facing-only-at-entry-exit':current?.phrase.spec.role === "fixture" ? "fixture-spatial-only" : "audience-biased",
        placementDecisions: [...this.placementDecisions.values()], predictionBudgetBpm: Math.max(180, this.bpm),
        headingBlendProgress: this.blend ? clamp((this.latestBeat - this.blend.startBeat) / this.blend.headingDurationBeats, 0, 1) : 1,
      },
    };
  }
}
