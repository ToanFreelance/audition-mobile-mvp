import * as THREE from "three";

/**
 * QA-only Mixamo contact IK. The authored mixer always writes the source pose
 * first; only the two leg chains are subsequently adjusted. All anchors are
 * actor-local: camera motion and Waiting Room formation cannot drag a shoe.
 *
 * V2: retain an existing planted foot through a crossfade, use lift-off rather
 * than raw horizontal sway to release, and measure actual grounded-foot travel.
 * No pelvis, torso, hand, source-clip, or gameplay clock modifications.
 */
const ACQUIRE_SECONDS = 0.085;
const FADE_IN_SECONDS = 0.12;
const FADE_OUT_SECONDS = 0.14;
const COOLDOWN_SECONDS = 0.085;
const PLANT_HEIGHT = 0.032;
const LIFT_HEIGHT = 0.063;
const MAX_STANCE_REACH = 0.14;
const FAST_STEP_DISTANCE = 0.075;

const clamp01 = (n: number) => THREE.MathUtils.clamp(n, 0, 1);

function findBone(rig: THREE.Skeleton, name: string) {
  const safe = THREE.PropertyBinding.sanitizeNodeName(name);
  return rig.bones.find(b => b.name === name || b.name === safe);
}

type Foot = {
  thigh: THREE.Bone;
  shin: THREE.Bone;
  ankle: THREE.Bone;
  baseY: number;
  anchor: THREE.Vector3 | null;
  previousRaw: THREE.Vector3 | null;
  previousCorrected: THREE.Vector3 | null;
  acquireSeconds: number;
  cooldown: number;
  weight: number;
  rawTravel: number;
  correctedTravel: number;
};

/** Aim a bone/child in world space, preserving the native animated knee plane. */
function aim(bone: THREE.Bone, child: THREE.Bone, goal: THREE.Vector3) {
  if (!bone.parent) return;
  const start = bone.getWorldPosition(new THREE.Vector3());
  const current = child.getWorldPosition(new THREE.Vector3()).sub(start);
  const desired = goal.clone().sub(start);
  if (current.lengthSq() < 1e-12 || desired.lengthSq() < 1e-12) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(current.normalize(), desired.normalize());
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent)).normalize();
  bone.updateWorldMatrix(false, true);
}

function applyLegIK(foot: Foot, goal: THREE.Vector3) {
  const { thigh, shin, ankle } = foot;
  const savedAnkleOrientation = ankle.getWorldQuaternion(new THREE.Quaternion());
  const hip = thigh.getWorldPosition(new THREE.Vector3());
  const knee = shin.getWorldPosition(new THREE.Vector3());
  const startAnkle = ankle.getWorldPosition(new THREE.Vector3());
  const upperLength = hip.distanceTo(knee);
  const lowerLength = knee.distanceTo(startAnkle);
  const toward = goal.clone().sub(hip);
  const requested = toward.length();
  if (Math.min(upperLength, lowerLength, requested) < 1e-5) return;
  const axis = toward.normalize();
  const reachable = THREE.MathUtils.clamp(requested,
    Math.abs(upperLength - lowerLength) + 1e-5, upperLength + lowerLength - 1e-5);
  const projection = (upperLength ** 2 - lowerLength ** 2 + reachable ** 2) / (2 * reachable);
  const elevation = Math.sqrt(Math.max(0, upperLength ** 2 - projection ** 2));
  const pole = knee.clone().sub(hip).addScaledVector(axis, -knee.clone().sub(hip).dot(axis));
  // Never invent an IK knee orientation for a degenerate straight leg.
  if (pole.lengthSq() < 1e-10) return;
  const kneeGoal = hip.clone().addScaledVector(axis, projection).addScaledVector(pole.normalize(), elevation);
  const ankleGoal = hip.clone().addScaledVector(axis, reachable);
  aim(thigh, shin, kneeGoal);
  aim(shin, ankle, ankleGoal);
  if (ankle.parent) {
    const parentWorld = ankle.parent.getWorldQuaternion(new THREE.Quaternion());
    ankle.quaternion.copy(parentWorld.invert().multiply(savedAnkleOrientation)).normalize();
    ankle.updateWorldMatrix(false, true);
  }
}

export type FootLockSample = {
  lockedFeet: number;
  maxContactError: number;
  contactTravel: number;
  plantedRawTravel: number;
  plantedCorrectedTravel: number;
};

export function createMixamoFootLock(actor: THREE.Object3D, rig: THREE.Skeleton, characterHeight: number) {
  const height = Math.max(0.01, characterHeight);
  actor.updateWorldMatrix(true, true);
  const entries = (["L", "R"] as const).map(side => {
    const thigh = findBone(rig, `upper_leg.${side}`);
    const shin = findBone(rig, `lower_leg.${side}`);
    const ankle = findBone(rig, `foot.${side}`);
    if (!thigh || !shin || !ankle) return null;
    return {
      thigh, shin, ankle,
      baseY: actor.worldToLocal(ankle.getWorldPosition(new THREE.Vector3())).y,
      anchor: null,
      previousRaw: null,
      previousCorrected: null,
      acquireSeconds: 0,
      cooldown: 0,
      weight: 0,
      rawTravel: 0,
      correctedTravel: 0,
    } satisfies Foot;
  });
  if (entries.some(foot => foot === null)) return null;
  const feet = entries as Foot[];

  return {
    update(deltaSeconds: number, crossfade: boolean): FootLockSample {
      const dt = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1);
      actor.updateWorldMatrix(true, true);
      let lockedFeet = 0, maxContactError = 0, contactTravel = 0;
      for (const foot of feet) {
        // Read the unmodified Mixamo pose. Its raw travel is the reference signal.
        const raw = actor.worldToLocal(foot.ankle.getWorldPosition(new THREE.Vector3()));
        const oldRaw = foot.previousRaw;
        const dx = oldRaw ? raw.x - oldRaw.x : 0;
        const dz = oldRaw ? raw.z - oldRaw.z : 0;
        const distancePerSecond = oldRaw && dt > 0 ? Math.hypot(dx, dz) / dt : 0;
        const upwardSpeed = oldRaw && dt > 0 ? (raw.y - oldRaw.y) / dt : 0;
        const clearance = raw.y - foot.baseY;
        const nearFloor = clearance <= height * PLANT_HEIGHT;
        const lifted = clearance > height * LIFT_HEIGHT ||
          (clearance > height * PLANT_HEIGHT && upwardSpeed > height * 0.18);
        foot.cooldown = Math.max(0, foot.cooldown - dt);

        // Capture a NEW contact only after a short stable period, avoiding
        // accidental locking of a skimming/swinging foot.
        const candidate = !crossfade && foot.cooldown <= 0 && nearFloor &&
          Math.abs(upwardSpeed) < height * 0.20 && distancePerSecond < height * 0.75;
        foot.acquireSeconds = candidate ? foot.acquireSeconds + dt : 0;
        if (!foot.anchor && foot.acquireSeconds >= ACQUIRE_SECONDS) {
          foot.anchor = raw.clone();
          foot.previousCorrected = null;
          foot.acquireSeconds = 0;
        }

        if (foot.anchor) {
          const distanceFromContact = Math.hypot(raw.x - foot.anchor.x, raw.z - foot.anchor.z);
          const deliberateFastStep = distanceFromContact > height * FAST_STEP_DISTANCE &&
            distancePerSecond > height * 1.65;
          const outOfReach = distanceFromContact > height * MAX_STANCE_REACH;
          // IMPORTANT: do not release merely because Mixer is crossfading, or
          // because the planted foot moves sideways with the animated pelvis.
          if (lifted || deliberateFastStep || outOfReach) {
            foot.cooldown = Math.max(foot.cooldown, COOLDOWN_SECONDS);
          }
        }

        const supported = Boolean(foot.anchor) && foot.cooldown <= 0 && !lifted;
        const desiredWeight = supported ? 1 : 0;
        foot.weight = clamp01(foot.weight + (desiredWeight
          ? (dt / FADE_IN_SECONDS) : -(dt / FADE_OUT_SECONDS)));
        if (!foot.anchor || foot.weight <= 1e-4) {
          if (!supported) {
            foot.anchor = null;
            foot.previousCorrected = null;
          }
          foot.previousRaw = raw;
          continue;
        }

        const horizontal = foot.anchor.clone().sub(raw);
        horizontal.y = 0; // Preserve original toe-off and foot lift height.
        const correction = horizontal.multiplyScalar(foot.weight);
        const limited = Math.min(correction.length(), height * MAX_STANCE_REACH);
        if (limited > 1e-7) {
          correction.setLength(limited);
          const correctedGoal = actor.localToWorld(raw.clone().add(correction));
          applyLegIK(foot, correctedGoal);
          actor.updateWorldMatrix(true, true);
        }
        const corrected = actor.worldToLocal(foot.ankle.getWorldPosition(new THREE.Vector3()));
        // These measurements only count consecutive frames of the SAME active
        // support contact; free footsteps and gait motion are excluded.
        if (foot.weight > 0.5) {
          lockedFeet++;
          const error = Math.hypot(corrected.x - foot.anchor.x, corrected.z - foot.anchor.z);
          maxContactError = Math.max(maxContactError, error);
          contactTravel = Math.max(contactTravel, limited);
          if (oldRaw && foot.previousCorrected) {
            foot.rawTravel += Math.hypot(dx, dz);
            foot.correctedTravel += Math.hypot(
              corrected.x - foot.previousCorrected.x, corrected.z - foot.previousCorrected.z,
            );
          }
          foot.previousCorrected = corrected;
        } else {
          foot.previousCorrected = null;
        }
        foot.previousRaw = raw;
      }
      return {
        lockedFeet,
        maxContactError,
        contactTravel,
        plantedRawTravel: feet.reduce((sum, foot) => sum + foot.rawTravel, 0),
        plantedCorrectedTravel: feet.reduce((sum, foot) => sum + foot.correctedTravel, 0),
      };
    },
  };
}