import * as THREE from "three";
import { MIXAMO_BONES } from "./mixamo-lobby-data";

/**
 * V12: compose the owner FBX greeting onto a validated M3 idle arm pose,
 * ONCE while assembling an AnimationClip (never during frame updates).
 *
 * The owner FBX intentionally keeps its non-gesturing LEFT arm extended in
 * its Mixamo T-pose for almost all 154 frames. Retargeting that static arm
 * verbatim into the five-person Waiting Room produces the reported T-pose.
 * Take the non-gesturing arm's authored Breathing Idle 2 curves instead,
 * while preserving the greeting's actively animated RIGHT arm in the middle.
 * Short weight envelopes return the gesture arm to neutral at both ends.
 *
 * Hips, legs, spine, head and all other authored source keyframes are intact.
 * This does not add a mixer, per-frame IK, extra scene actor or runtime stance.
 */
export function bakeStandingGreetingIdleArmsV12(
  source: THREE.AnimationClip,
  neutral: THREE.AnimationClip,
  rig: THREE.Skeleton,
): THREE.AnimationClip {
  const neutralTracks = new Map(neutral.tracks.map(track => [track.name, track]));
  const armSide = new Map<string, "L" | "R">();
  const armRoots = new Set([
    "shoulder", "upper_arm", "lower_arm", "hand",
    "thumb", "index", "middle", "ring", "little",
  ]);
  for (const name of MIXAMO_BONES) {
    const parts = name.split(".");
    if (!armRoots.has(parts[0])) continue;
    const side = parts[parts.length - 1];
    if (side !== "L" && side !== "R") continue;
    const bone = rig.bones.find(candidate =>
      candidate.name === name ||
      candidate.name === THREE.PropertyBinding.sanitizeNodeName(name));
    if (bone) armSide.set(bone.uuid + ".quaternion", side);
  }
  if (!armSide.size) throw Error("Greeting V12: M3 arm bones unavailable");

  let changedLeft = 0;
  let changedRight = 0;
  const next = source.tracks.map(track => {
    const side = armSide.get(track.name);
    if (!side || !(track instanceof THREE.QuaternionKeyframeTrack))
      return track.clone();
    const idle = neutralTracks.get(track.name);
    if (!(idle instanceof THREE.QuaternionKeyframeTrack))
      throw Error("Greeting V12: missing neutral animation for " + track.name);

    const idleSample = idle.createInterpolant();
    const values = new Float32Array(track.values.length);
    const src = new THREE.Quaternion();
    const rest = new THREE.Quaternion();
    const last = new THREE.Quaternion();
    const timeMax = Math.max(0, neutral.duration - 1 / 30);
    for (let frame = 0; frame < track.times.length; frame++) {
      const seconds = track.times[frame];
      // The validated breathing clip is independent of the greeting's 5.1s
      // duration; only its existing arm motion is sampled.
      const idleTime = Math.min(timeMax, seconds % Math.max(.01, neutral.duration));
      rest.fromArray(idleSample.evaluate(idleTime) as ArrayLike<number>);
      src.fromArray(track.values, frame * 4);
      const blend = side === "L" ? 0 :
        THREE.MathUtils.smoothstep(seconds, .65, 1.65) *
        (1 - THREE.MathUtils.smoothstep(seconds, 3.65, 4.65));
      rest.slerp(src, blend).normalize();
      if (frame && rest.dot(last) < 0)
        rest.set(-rest.x, -rest.y, -rest.z, -rest.w);
      rest.toArray(values, frame * 4);
      last.copy(rest);
    }
    if (side === "L") changedLeft++;
    else changedRight++;
    return new THREE.QuaternionKeyframeTrack(
      track.name, track.times, values, THREE.InterpolateLinear);
  });
  if (!changedLeft || !changedRight)
    throw Error("Greeting V12: cannot compose both idle arm chains");
  return new THREE.AnimationClip(
    source.name + "-idle-pose-v12", source.duration, next);
}
