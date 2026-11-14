import * as THREE from "three";

/**
 * Original procedural QA choreography, NOT an Audition gameplay animation.
 * 8 beats per loop at 110 BPM with deliberately large whole-body deformation.
 * Every track targets the current body's bone UUID, never a donor garment rig.
 */
export type MotionId = "groove" | "shuffle" | "stress";
export const MOTIONS: ReadonlyArray<{ id: MotionId; label: string; description: string }> = [
  { id: "groove", label: "Groove", description: "Sway, tay, nhún gối" },
  { id: "shuffle", label: "Street Shuffle", description: "Bước chéo, nâng chân, xoay hông" },
  { id: "stress", label: "Low & Reach", description: "Hạ trọng tâm, vươn tay, test clipping" },
];

type Angles = readonly [number, number, number];
type Pose = { rotations: Record<string, Angles>; hips: readonly [number, number, number] };
const BPM = 110;
const PHRASE_BEATS = 8;
const SAMPLE_COUNT = 65;

function poseAt(id: MotionId, beat: number): Pose {
  const a = beat * Math.PI / 2;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const beatPulse = Math.sin(beat * Math.PI);
  const envelope = Math.sin(Math.PI * beat / PHRASE_BEATS) ** 2;
  const leftLift = Math.max(0, s);
  const rightLift = Math.max(0, -s);
  // All three motions return to the original rest pose at the loop seam.
  if (id === "groove") {
    return {
      rotations: {
        hips: [0, envelope * 0.10 * s, envelope * 0.10 * c],
        spine: [envelope * 0.10 * beatPulse, envelope * 0.20 * s, envelope * 0.12 * c],
        chest: [0, envelope * 0.13 * s, envelope * 0.08 * c],
        "upper_arm.L": [envelope * -0.23 * c, 0, envelope * (-0.36 - 0.23 * s)],
        "upper_arm.R": [envelope * -0.22 * s, 0, envelope * (0.36 + 0.23 * c)],
        "lower_arm.L": [envelope * -0.31, 0, 0],
        "lower_arm.R": [envelope * -0.36, 0, 0],
        "upper_leg.L": [envelope * (0.13 * s), 0, envelope * 0.06 * c],
        "upper_leg.R": [envelope * (-0.13 * s), 0, envelope * -0.06 * c],
        "lower_leg.L": [envelope * 0.11 * leftLift, 0, 0],
        "lower_leg.R": [envelope * 0.11 * rightLift, 0, 0],
      },
      hips: [envelope * 0.045 * s, envelope * (0.03 * (1 + beatPulse) - 0.018), 0],
    };
  }
  if (id === "shuffle") {
    return {
      rotations: {
        hips: [envelope * 0.06 * c, envelope * 0.27 * s, envelope * 0.13 * s],
        spine: [envelope * 0.18 * c, envelope * -0.34 * s, envelope * -0.17 * s],
        chest: [0, envelope * -0.18 * s, envelope * 0.13 * c],
        "upper_arm.L": [envelope * (-0.30 - 0.22 * s), envelope * 0.14, envelope * (-0.55 + 0.30 * c)],
        "upper_arm.R": [envelope * (-0.36 + 0.20 * s), envelope * -0.14, envelope * (0.55 - 0.30 * c)],
        "lower_arm.L": [envelope * (-0.55 - 0.15 * c), 0, 0],
        "lower_arm.R": [envelope * (-0.52 + 0.15 * c), 0, 0],
        "upper_leg.L": [envelope * (0.51 * leftLift - 0.16 * rightLift), envelope * 0.09 * s, 0],
        "upper_leg.R": [envelope * (0.51 * rightLift - 0.16 * leftLift), envelope * -0.09 * s, 0],
        "lower_leg.L": [envelope * 0.65 * leftLift, 0, 0],
        "lower_leg.R": [envelope * 0.65 * rightLift, 0, 0],
        "foot.L": [envelope * -0.17 * leftLift, 0, 0],
        "foot.R": [envelope * -0.17 * rightLift, 0, 0],
      },
      hips: [envelope * 0.095 * s, envelope * (0.035 * Math.abs(s) + 0.08 * Math.max(leftLift, rightLift)), envelope * 0.035 * c],
    };
  }
  const crouch = envelope * (0.5 + 0.5 * Math.cos(a));
  const reach = envelope * (0.5 + 0.5 * Math.sin(a));
  return {
    rotations: {
      hips: [envelope * -0.16 * s, envelope * 0.24 * s, envelope * 0.14 * c],
      spine: [envelope * (0.27 * c - 0.20 * crouch), envelope * -0.27 * s, envelope * 0.18 * s],
      chest: [envelope * -0.14 * crouch, envelope * 0.20 * s, 0],
      "upper_arm.L": [envelope * -0.62 * reach, envelope * 0.18 * c, envelope * (-0.28 - 0.85 * reach)],
      "upper_arm.R": [envelope * -0.67 * reach, envelope * -0.18 * c, envelope * (0.28 + 0.85 * reach)],
      "lower_arm.L": [envelope * (-0.55 - 0.20 * crouch), 0, 0],
      "lower_arm.R": [envelope * (-0.55 - 0.20 * crouch), 0, 0],
      "upper_leg.L": [envelope * (-0.33 * crouch + 0.18 * leftLift), 0, envelope * 0.10],
      "upper_leg.R": [envelope * (-0.33 * crouch + 0.18 * rightLift), 0, envelope * -0.10],
      "lower_leg.L": [envelope * 0.85 * crouch, 0, 0],
      "lower_leg.R": [envelope * 0.85 * crouch, 0, 0],
      "foot.L": [envelope * -0.35 * crouch, 0, 0],
      "foot.R": [envelope * -0.35 * crouch, 0, 0],
      neck: [envelope * -0.07 * crouch, 0, 0],
    },
    hips: [envelope * 0.045 * s, -0.15 * crouch + envelope * 0.018 * beatPulse, 0],
  };
}

/**
 * GLTFLoader r180 calls PropertyBinding.sanitizeNodeName() on glTF node names.
 * Thus VRM 'upper_arm.L' becomes a Three.js Bone named 'upper_armL', while
 * name checks against raw VRM strings silently dropped all limb tracks.
 * Resolve against the SAME imported bone naming convention as GLTFLoader.
 */
function resolveBone(skeleton: THREE.Skeleton, sourceName: string): THREE.Bone | undefined {
  const runtimeName = THREE.PropertyBinding.sanitizeNodeName(sourceName);
  return skeleton.bones.find((bone) => bone.name === runtimeName || bone.name === sourceName);
}

export function makeMotionClip(skeleton: THREE.Skeleton, id: MotionId): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const times = Array.from({ length: SAMPLE_COUNT }, (_, i) => (PHRASE_BEATS * 60 / BPM) * i / (SAMPLE_COUNT - 1));
  const samples = times.map((_, i) => poseAt(id, PHRASE_BEATS * i / (SAMPLE_COUNT - 1)));
  const names = Object.keys(samples[0].rotations);
  const missing: string[] = [];
  const rotation = new THREE.Quaternion();
  for (const name of names) {
    const bone = resolveBone(skeleton, name);
    if (!bone) {
      missing.push(name);
      continue;
    }
    const baseline = bone.quaternion.clone();
    const values: number[] = [];
    for (const sample of samples) {
      const angles = sample.rotations[name];
      rotation.setFromEuler(new THREE.Euler(...angles));
      rotation.premultiply(baseline);
      values.push(rotation.x, rotation.y, rotation.z, rotation.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, values));
  }
  const hips = resolveBone(skeleton, "hips");
  if (hips) {
    const baseline = hips.position.clone();
    const values = samples.flatMap((sample) => [
      baseline.x + sample.hips[0],
      baseline.y + sample.hips[1],
      baseline.z + sample.hips[2],
    ]);
    tracks.push(new THREE.VectorKeyframeTrack(`${hips.uuid}.position`, times, values));
  }
  if (tracks.length < 10 || missing.length > 0 || !hips) {
    throw new Error(
      `QA motion ${id}: ${tracks.length} tracks; ${missing.length} thiếu bone: ${missing.join(", ") || "(none)"}.`,
    );
  }
  return new THREE.AnimationClip(`M3 QA / ${id} / 110 BPM`, PHRASE_BEATS * 60 / BPM, tracks);
}
