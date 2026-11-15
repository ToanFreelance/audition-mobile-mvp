import * as THREE from "three";

/**
 * M3-only Waiting Room procedural idle: no AnimationMixer, no gameplay clock.
 * Mutates bones of the per-participant SkeletonUtils clone only.
 * Updated by the existing 30 FPS lobby render loop.
 */
export type M3LobbyIdle = {
  elapsedSeconds: number;
  hasScratchPose: boolean;
  update(deltaSeconds: number): void;
};

type Pose = { bone: THREE.Bone; rest: THREE.Quaternion; scratch?: THREE.Quaternion };
const axisX = new THREE.Vector3(1, 0, 0);
const axisY = new THREE.Vector3(0, 1, 0);
const axisZ = new THREE.Vector3(0, 0, 1);

function hashId(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function getBone(skeleton: THREE.Skeleton, name: string): THREE.Bone | undefined {
  const safe = THREE.PropertyBinding.sanitizeNodeName(name);
  return skeleton.bones.find(bone => bone.name === name || bone.name === safe);
}

function aim(bone: THREE.Bone, child: THREE.Bone, target: THREE.Vector3): boolean {
  bone.updateWorldMatrix(true, true);
  const origin = bone.getWorldPosition(new THREE.Vector3());
  const current = child.getWorldPosition(new THREE.Vector3()).sub(origin);
  const desired = target.clone().sub(origin);
  if (current.lengthSq() < 1e-9 || desired.lengthSq() < 1e-9) return false;
  const delta = new THREE.Quaternion().setFromUnitVectors(current.normalize(), desired.normalize());
  const parent = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent)).normalize();
  bone.updateWorldMatrix(true, true);
  return true;
}

/** Author one two-bone pose toward the outer hair/temple; preserve limb lengths. */
function buildScratchPose(
  upper: Pose, lower: Pose, hand: THREE.Bone, head: THREE.Bone, side: number, height: number,
): boolean {
  upper.bone.updateWorldMatrix(true, true);
  const shoulder = upper.bone.getWorldPosition(new THREE.Vector3());
  const elbow = lower.bone.getWorldPosition(new THREE.Vector3());
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  const a = shoulder.distanceTo(elbow), b = elbow.distanceTo(wrist);
  if (a < 1e-5 || b < 1e-5) return false;
  const target = head.getWorldPosition(new THREE.Vector3()).add(
    new THREE.Vector3(side * height * .074, height * .078, height * .085));
  const toTarget = target.sub(shoulder);
  const desiredDistance = toTarget.length();
  if (desiredDistance < 1e-5) return false;
  const direction = toTarget.normalize();
  const distance = THREE.MathUtils.clamp(
    desiredDistance, Math.abs(a - b) + .001, (a + b) * .97);
  const reachable = shoulder.clone().addScaledVector(direction, distance);
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const elevation = Math.sqrt(Math.max(0, a * a - along * along));
  const outward = new THREE.Vector3(side, .10, .33);
  outward.addScaledVector(direction, -outward.dot(direction)).normalize();
  const elbowTarget = shoulder.clone().addScaledVector(direction, along)
    .addScaledVector(outward, elevation);
  const ok = aim(upper.bone, lower.bone, elbowTarget) && aim(lower.bone, hand, reachable);
  if (ok) {
    upper.scratch = upper.bone.quaternion.clone();
    lower.scratch = lower.bone.quaternion.clone();
  }
  lower.bone.quaternion.copy(lower.rest);
  upper.bone.quaternion.copy(upper.rest);
  upper.bone.updateWorldMatrix(true, true);
  return ok;
}

function ease(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function createM3LobbyIdle(
  actor: THREE.Object3D, participantId: string, roomId: string,
): M3LobbyIdle | null {
  let skeleton: THREE.Skeleton | null = null;
  actor.traverse(node => {
    const mesh = node as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh && (!skeleton || mesh.skeleton.bones.length > skeleton.bones.length)) {
      skeleton = mesh.skeleton;
    }
  });
  if (!skeleton) return null;
  const rig = skeleton as THREE.Skeleton;
  const capture = (name: string): Pose | undefined => {
    const bone = getBone(rig, name);
    return bone ? { bone, rest: bone.quaternion.clone() } : undefined;
  };
  const spine = capture("spine"), hips = capture("hips"), neck = capture("neck"), head = capture("head");
  const armL = capture("upper_arm.L"), armR = capture("upper_arm.R");
  const elbowL = capture("lower_arm.L"), elbowR = capture("lower_arm.R");
  const handL = capture("hand.L"), handR = capture("hand.R");
  const legL = capture("upper_leg.L"), legR = capture("upper_leg.R");
  if (!spine || !hips || !neck || !head || !armL || !armR ||
    !elbowL || !elbowR || !handL || !handR || !legL || !legR) return null;

  const seed = hashId(roomId + ":" + participantId);
  const useLeft = Boolean(seed & 1);
  const scratchArm = useLeft ? armL : armR;
  const scratchElbow = useLeft ? elbowL : elbowR;
  const scratchHand = useLeft ? handL : handR;
  scratchArm.bone.updateWorldMatrix(true, true);
  const side = Math.sign(scratchArm.bone.getWorldPosition(new THREE.Vector3()).x
    - head.bone.getWorldPosition(new THREE.Vector3()).x) || (useLeft ? -1 : 1);
  const size = new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3());
  const hasScratchPose = size.y > 0 && Number.isFinite(size.y) &&
    buildScratchPose(scratchArm, scratchElbow, scratchHand.bone, head.bone, side, size.y);

  const phase = ((seed >>> 4) % 628) / 100;
  const scratchDelay = 4 + seed % 7;
  const period = 13 + ((seed >>> 8) % 7);
  const temp = new THREE.Quaternion();
  const rotate = (pose: Pose, axis: THREE.Vector3, radians: number) => {
    pose.bone.quaternion.copy(pose.rest).multiply(temp.setFromAxisAngle(axis, radians));
  };
  const runtime: M3LobbyIdle = {
    elapsedSeconds: 0,
    hasScratchPose,
    update(deltaSeconds) {
      runtime.elapsedSeconds += THREE.MathUtils.clamp(deltaSeconds, 0, .1);
      const time = runtime.elapsedSeconds;
      const sway = Math.sin(time * 1.3 + phase);
      const breathe = Math.sin(time * 1.95 + phase * .68);
      const shift = Math.sin(time * .86 + phase);
      // Calm movement, planted feet: bone rotations only, no actor root motion.
      rotate(spine, axisZ, .034 * sway);
      spine.bone.quaternion.multiply(temp.setFromAxisAngle(axisX, .013 * breathe));
      rotate(neck, axisZ, -.024 * sway);
      rotate(head, axisY, .022 * Math.sin(time * .64 + phase));
      head.bone.quaternion.multiply(temp.setFromAxisAngle(axisZ, -.012 * sway));
      rotate(hips, axisZ, -.009 * sway);
      rotate(legL, axisX, .014 * shift);
      rotate(legR, axisX, -.014 * shift);
      const swing = .050 * Math.sin(time * 1.35 + phase);
      rotate(armL, axisX, swing);
      rotate(armR, axisX, -swing);
      rotate(elbowL, axisZ, .021 * breathe);
      rotate(elbowR, axisZ, -.021 * breathe);
      rotate(scratchHand, axisZ, 0);
      if (hasScratchPose && time >= scratchDelay) {
        const t = (time - scratchDelay) % period;
        const weight = ease(t / .82) * (1 - ease((t - 2.28) / .88));
        if (weight > 0) {
          scratchArm.bone.quaternion.slerpQuaternions(scratchArm.rest, scratchArm.scratch!, weight);
          scratchElbow.bone.quaternion.slerpQuaternions(scratchElbow.rest, scratchElbow.scratch!, weight);
          rotate(scratchHand, axisZ, Math.sin(time * 17) * .12 * weight);
          head.bone.quaternion.multiply(temp.setFromAxisAngle(axisX, .021 * weight));
        }
      }
    },
  };
  return runtime;
}
