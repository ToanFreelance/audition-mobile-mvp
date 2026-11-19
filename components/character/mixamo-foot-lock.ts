import * as THREE from "three";

/**
 * QA-only Mixamo contact stabilization, applied AFTER AnimationMixer.
 * Never modifies the source animation, upper body, actor root, or gameplay clock.
 * Targets are kept in actor-local space so stage placement / camera transitions
 * do not pin shoes to a stale world-space position.
 */
const LOCK_IN = 0.16;
const LOCK_OUT = 0.10;
const MAX_CORRECTION_FRAC = 0.06;
const PLANT_HEIGHT_FRAC = 0.023;
const RELEASE_HEIGHT_FRAC = 0.043;

function bone(rig: THREE.Skeleton, id: string): THREE.Bone | undefined {
  const safe = THREE.PropertyBinding.sanitizeNodeName(id);
  return rig.bones.find(item => item.name === id || item.name === safe);
}

type Leg = {
  thigh: THREE.Bone;
  shin: THREE.Bone;
  ankle: THREE.Bone;
  groundY: number;
  anchor: THREE.Vector3 | null;
  lastRaw: THREE.Vector3 | null;
  weight: number;
  coolDown: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Rotate a bone so its child aims toward a world-space target. */
function aim(b: THREE.Bone, child: THREE.Bone, target: THREE.Vector3) {
  const from = b.getWorldPosition(new THREE.Vector3());
  const oldDirection = child.getWorldPosition(new THREE.Vector3()).sub(from);
  const newDirection = target.clone().sub(from);
  if (oldDirection.lengthSq() < 1e-12 || newDirection.lengthSq() < 1e-12 || !b.parent) return;
  const worldDelta = new THREE.Quaternion().setFromUnitVectors(oldDirection.normalize(), newDirection.normalize());
  const parentWorld = b.parent.getWorldQuaternion(new THREE.Quaternion());
  const localDelta = parentWorld.clone().invert().multiply(worldDelta).multiply(parentWorld);
  b.quaternion.premultiply(localDelta).normalize();
  b.updateWorldMatrix(false, true);
}

/** Two-bone IK keeping animated bend direction and original ankle orientation. */
function alignAnkle(leg: Leg, targetWorld: THREE.Vector3) {
  const { thigh, shin, ankle } = leg;
  const beforeAnkleRotation = ankle.getWorldQuaternion(new THREE.Quaternion());
  const hip = thigh.getWorldPosition(new THREE.Vector3());
  const knee = shin.getWorldPosition(new THREE.Vector3());
  const foot = ankle.getWorldPosition(new THREE.Vector3());
  const a = hip.distanceTo(knee), b = knee.distanceTo(foot);
  const toward = targetWorld.clone().sub(hip);
  const d = toward.length();
  if (a < 1e-5 || b < 1e-5 || d < 1e-5) return;
  const direction = toward.multiplyScalar(1 / d);
  const distance = THREE.MathUtils.clamp(d, Math.abs(a - b) + 1e-5, a + b - 1e-5);
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const rise = Math.sqrt(Math.max(0, a * a - along * along));
  // Keep the CURRENT Mixamo knee plane; never force a generic forward-facing knee.
  const bent = knee.clone().sub(hip);
  bent.addScaledVector(direction, -bent.dot(direction));
  if (bent.lengthSq() < 1e-10) {
    // Degenerate straight leg: preserve source animation rather than pick random pole.
    return;
  }
  const targetKnee = hip.clone().addScaledVector(direction, along).addScaledVector(bent.normalize(), rise);
  const reachableAnkle = hip.clone().addScaledVector(direction, distance);
  aim(thigh, shin, targetKnee);
  aim(shin, ankle, reachableAnkle);
  // Prevent forced foot tilting while correcting knee/ankle placement.
  if (ankle.parent) {
    const parentRotation = ankle.parent.getWorldQuaternion(new THREE.Quaternion());
    ankle.quaternion.copy(parentRotation.invert().multiply(beforeAnkleRotation)).normalize();
    ankle.updateWorldMatrix(false, true);
  }
}

export type FootLockSample = {
  lockedFeet: number;
  maxContactError: number;
  contactTravel: number;
};

export function createMixamoFootLock(actor: THREE.Object3D, rig: THREE.Skeleton, characterHeight: number) {
  const scale = Math.max(0.01, characterHeight);
  actor.updateWorldMatrix(true, true);
  const legs = (["L", "R"] as const).map(side => {
    const thigh = bone(rig, `upper_leg.${side}`);
    const shin = bone(rig, `lower_leg.${side}`);
    const ankle = bone(rig, `foot.${side}`);
    if (!thigh || !shin || !ankle) return null;
    return {
      thigh, shin, ankle,
      groundY: actor.worldToLocal(ankle.getWorldPosition(new THREE.Vector3())).y,
      anchor: null, lastRaw: null, weight: 0, coolDown: 0,
    } satisfies Leg;
  });
  if (legs.some(item => item === null)) return null;
  const items = legs as Leg[];
  return {
    update(seconds: number, crossfade: boolean): FootLockSample {
      const dt = Math.max(0, Math.min(seconds, 0.1));
      actor.updateWorldMatrix(true, true);
      let lockedFeet = 0, maxContactError = 0, contactTravel = 0;
      for (const leg of items) {
        const raw = actor.worldToLocal(leg.ankle.getWorldPosition(new THREE.Vector3()));
        const vertical = raw.y - leg.groundY;
        const speed = dt > 0 && leg.lastRaw
          ? raw.distanceTo(leg.lastRaw) / dt : 0;
        leg.lastRaw = raw.clone();
        leg.coolDown = Math.max(0, leg.coolDown - dt);
        const nearGround = vertical <= PLANT_HEIGHT_FRAC * scale;
        const released = vertical > RELEASE_HEIGHT_FRAC * scale;
        if (released || crossfade) leg.coolDown = Math.max(leg.coolDown, released ? 0.09 : 0.12);
        const eligible = !crossfade && leg.coolDown <= 0 && nearGround && speed < scale * 0.50;
        if (!leg.anchor && eligible) leg.anchor = raw.clone();
        if (leg.anchor) {
          const drift = new THREE.Vector2(raw.x - leg.anchor.x, raw.z - leg.anchor.z).length();
          // Prevent huge leg stretch: this is a stabilization pass, not a stance editor.
          if (drift > scale * MAX_CORRECTION_FRAC || released) leg.coolDown = Math.max(leg.coolDown, 0.13);
        }
        const targetWeight = leg.anchor && eligible && leg.coolDown <= 0 ? 1 : 0;
        leg.weight = clamp01(leg.weight + (targetWeight ? dt / LOCK_IN : -dt / LOCK_OUT));
        if (!leg.anchor || leg.weight < 1e-4) {
          if (!targetWeight) leg.anchor = null;
          continue;
        }
        const correction = leg.anchor.clone().sub(raw);
        correction.y = 0; // Do not force ankle height; preserve authored knee/foot lifts.
        correction.multiplyScalar(leg.weight);
        const magnitude = correction.length();
        if (magnitude < 1e-6) continue;
        const correctedLocal = raw.clone().add(correction);
        alignAnkle(leg, actor.localToWorld(correctedLocal));
        actor.updateWorldMatrix(true, true);
        const corrected = actor.worldToLocal(leg.ankle.getWorldPosition(new THREE.Vector3()));
        const error = new THREE.Vector2(corrected.x - leg.anchor.x, corrected.z - leg.anchor.z).length();
        maxContactError = Math.max(maxContactError, error);
        contactTravel = Math.max(contactTravel, magnitude);
        if (leg.weight > 0.5) lockedFeet++;
      }
      return {lockedFeet, maxContactError, contactTravel};
    },
  };
}