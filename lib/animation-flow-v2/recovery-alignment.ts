import * as T from "three";
import { rootYaw, type Pose, type PreparedPhrase, type SourceFlowEngine } from "./engine";
import { wrapAngle } from "./heading";

const Y = new T.Vector3(0, 1, 0);
const ease = (t: number) => t * t * (3 - 2 * t);
/** Same-canonical-rig contact handoff, exclusively for the two QA recovery phrases.
 * Transfer weight before playing the authored closing step. Small contact
 * corrections stay planted; incompatible feet take two short staggered steps.
 * Mirror the closing step when that keeps its entire root path inside the stage. */
export function alignRecovery(engine: SourceFlowEngine, source: PreparedPhrase, mirrored: boolean): PreparedPhrase {
  const heading = rootYaw(engine.rig.bones[0].quaternion), inverse = new T.Quaternion().setFromAxisAngle(Y, -heading);
  const before = engine.snapshot(), lead = .6;
  const scratch = engine.rig.root.clone(true), bones: T.Bone[] = [];
  scratch.traverse(o => { if ((o as T.Bone).isBone) bones.push(o as T.Bone); });
  const names = engine.rig.names, byName = (name: string) => bones[names.indexOf(name)];
  const get = (name: string) => byName(name).getWorldPosition(new T.Vector3());
  const rootBefore = new T.Vector3(0, before.root[1], 0);
  const out = engine.rig.bones.map((b, i) => i ? b.quaternion.clone() : b.quaternion.clone().premultiply(inverse));
  function apply(root: T.Vector3, qs: T.Quaternion[]) { scratch.position.copy(root); bones.forEach((b, i) => b.quaternion.copy(qs[i])); scratch.updateMatrixWorld(true); }
  function authored(t: number): Pose {
    const root = new T.Vector3().fromArray(source.translation.evaluate(t)); if (mirrored) root.x = -root.x;
    return { root, rotations: names.map((name, i) => {
      const counterpart = mirrored ? name.startsWith("Left") ? name.replace("Left", "Right") : name.startsWith("Right") ? name.replace("Right", "Left") : name : name;
      const q = new T.Quaternion().fromArray(source.rotations[names.indexOf(counterpart)]?.evaluate(t) ?? source.rotations[i].evaluate(t));
      return mirrored ? new T.Quaternion(q.x, -q.y, -q.z, q.w) : q;
    }) };
  }
  apply(rootBefore, out);
  const oldFeet = [get("LeftFoot"), get("RightFoot")];
  const entry = authored(0); apply(entry.root, entry.rotations);
  const newFeet = [get("LeftFoot"), get("RightFoot")];
  const shift = oldFeet[0].clone().add(oldFeet[1]).sub(newFeet[0]).sub(newFeet[1]).multiplyScalar(.5); shift.y = 0;
  const targets = newFeet.map(p => p.clone().add(shift));
  const lengths = ["Left", "Right"].map(side => [byName(side + "Leg").position.length(), byName(side + "Foot").position.length()]);
  function worldRotation(bone: T.Bone, q: T.Quaternion) {
    const parent = bone.parent?.getWorldQuaternion(new T.Quaternion()) ?? new T.Quaternion();
    bone.quaternion.copy(parent.invert().multiply(q)); scratch.updateMatrixWorld(true);
  }
  function leg(side: string, target: T.Vector3, length: number[]) {
    const upper = byName(side + "UpLeg"), lower = byName(side + "Leg"), foot = byName(side + "Foot");
    const a = upper.getWorldPosition(new T.Vector3()), b = lower.getWorldPosition(new T.Vector3());
    const footQ = foot.getWorldQuaternion(new T.Quaternion()), dir = target.clone().sub(a);
    const d = T.MathUtils.clamp(dir.length(), Math.abs(length[0] - length[1]) + .00001, length[0] + length[1] - .00001); dir.normalize();
    const pole = b.clone().sub(a).addScaledVector(dir, -b.clone().sub(a).dot(dir));
    if (pole.lengthSq() < 1e-8) pole.set(0, 0, 1).addScaledVector(dir, -dir.z);
    pole.normalize();
    const along = (length[0] ** 2 - length[1] ** 2 + d ** 2) / (2 * d);
    const knee = a.clone().addScaledVector(dir, along).addScaledVector(pole, Math.sqrt(Math.max(0, length[0] ** 2 - along ** 2)));
    worldRotation(upper, new T.Quaternion().setFromUnitVectors(b.clone().sub(a).normalize(), knee.clone().sub(a).normalize()).multiply(upper.getWorldQuaternion(new T.Quaternion())));
    const actualKnee = lower.getWorldPosition(new T.Vector3()), actualFoot = foot.getWorldPosition(new T.Vector3());
    worldRotation(lower, new T.Quaternion().setFromUnitVectors(actualFoot.sub(actualKnee).normalize(), target.clone().sub(actualKnee).normalize()).multiply(lower.getWorldQuaternion(new T.Quaternion())));
    worldRotation(foot, footQ);
  }
  const duration = lead + source.duration, times: number[] = [], roots: number[] = [], values = names.map(() => [] as number[]), path: T.Vector3[] = [], headings: number[] = [];
  const count = Math.ceil(duration * 60);
  let maxEntryFootAdjustment = 0;
  for (let frame = 0; frame <= count; frame++) {
    const t = frame === count ? duration : frame / 60;
    let pose: Pose;
    if (t < lead) {
      const weight = ease(t / lead), qs = out.map((q, i) => q.clone().slerp(entry.rotations[i], weight));
      const root = rootBefore.clone().lerp(entry.root.clone().add(shift), weight);
      apply(root, qs);
      const feet = oldFeet.map((p, i) => {
        const distance = Math.hypot(p.x-targets[i].x,p.z-targets[i].z);
        const progress = distance > .08 ? T.MathUtils.clamp(t / lead * 2 - i,0,1) : t / lead;
        const target = p.clone().lerp(targets[i],ease(progress));
        if(distance > .08) target.y += .09 * Math.sin(Math.PI * progress);
        return target;
      });
      // Avoid a straight/hyperextended knee while the pelvis transfers weight.
      for (let side = 0; side < 2; side++) {
        const hip = get(side ? "RightUpLeg" : "LeftUpLeg"), horizontal = Math.hypot(feet[side].x - hip.x, feet[side].z - hip.z), reach = lengths[side][0] + lengths[side][1] - .001;
        root.y = Math.min(root.y, feet[side].y + Math.sqrt(Math.max(.01, reach ** 2 - horizontal ** 2)) - (hip.y - root.y));
      }
      apply(root, qs); leg("Left", feet[0], lengths[0]); leg("Right", feet[1], lengths[1]);
      pose = { root, rotations: bones.map(b => b.quaternion.clone()) };
      maxEntryFootAdjustment = Math.max(maxEntryFootAdjustment, ...oldFeet.map((p, i) => p.distanceTo(targets[i])));
    } else { pose = authored(t - lead); pose.root.add(shift); }
    // Output rotations in placement-local space, with a zero-XZ entry.
    times.push(t); roots.push(...pose.root.toArray()); path.push(pose.root.clone());
    pose.rotations.forEach((q, i) => { q.normalize(); const prior = values[i].slice(-4); if (prior.length && q.dot(new T.Quaternion().fromArray(prior)) < 0) q.set(-q.x,-q.y,-q.z,-q.w); values[i].push(...q.toArray()); });
    const yaw = rootYaw(pose.rotations[0]); headings.push(frame ? headings[frame-1] + wrapAngle(yaw - headings[frame-1]) : yaw);
  }
  const tracks: T.KeyframeTrack[] = [new T.VectorKeyframeTrack("motionRoot.position", times, roots), ...names.map((name,i)=>new T.QuaternionKeyframeTrack(name+".quaternion",times,values[i]))];
  const sampler = (t:T.KeyframeTrack)=>(t as T.KeyframeTrack & {createInterpolant():{evaluate(t:number):ArrayLike<number>}}).createInterpolant();
  return { ...source, spec: { ...source.spec, exitMarkers:[duration], protectedRanges:[[0,duration]] }, duration,
    clip:new T.AnimationClip(source.spec.id,duration,tracks), translation:sampler(tracks[0]), rotations:tracks.slice(1).map(sampler), path, headings,
    recoveryAlignment:{yaw:heading,leadInSeconds:lead,mirrored,rootShiftLocalXZ:[shift.x,shift.z],maxEntryFootAdjustment} };
}
