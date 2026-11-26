import * as T from "three";

/** Fixed stage reference, shared with the INITIAL camera only; never OrbitControls. */
export const INITIAL_CAMERA = [2.65, 1.9, 3.7] as const;
export const STAGE_FRONT = Math.atan2(INITIAL_CAMERA[0], INITIAL_CAMERA[2]);
export const HEADING_LIMITS = {
  entryDeg: 60, phraseDeg: 85,
  transitionAddedYawDegPerSecond: 270, transitionHeadingDeltaDeg: 45,
} as const;
export const wrapAngle = (radians: number) => Math.atan2(Math.sin(radians), Math.cos(radians));
export const degrees = T.MathUtils.radToDeg;
export function headingOf(q: T.Quaternion, forward = new T.Vector3(0, 0, 1)) {
  const v = forward.clone().applyQuaternion(q);
  return Math.atan2(v.x, v.z);
}

/** CMU-only explicit calibration, not a generic retargeting/front-axis detector.
 * L/R hip labels establish anatomical right. Up × right gives the front sign;
 * toe offsets and shoulder line corroborate it in the canonical rest hierarchy.
 * Root/shoulder animation still has to be visually qualified on WebGL.
 */
export function calibrateForward(root: T.Bone, bones: T.Bone[]) {
  root.updateMatrixWorld(true);
  const position = (name: string) => {
    const b = bones.find(b => b.name === name); if (!b) throw new Error(`Thiếu mốc calibration ${name}`);
    return b.getWorldPosition(new T.Vector3());
  };
  const front = (left: string, right: string) => new T.Vector3(0, 1, 0).cross(position(right).sub(position(left))).normalize();
  const pelvis = front("LeftUpLeg", "RightUpLeg"), shoulders = front("LeftArm", "RightArm");
  const toes = position("LeftToeBase").sub(position("LeftFoot")).add(position("RightToeBase").sub(position("RightFoot")));
  toes.y = 0; toes.normalize();
  const evidence = { pelvis: pelvis.toArray(), shoulders: shoulders.toArray(), toes: toes.toArray(), toeAgreement: pelvis.dot(toes), shoulderAgreement: pelvis.dot(shoulders) };
  if (pelvis.dot(new T.Vector3(0, 0, 1)) < 0.99 || evidence.toeAgreement < 0.9 || evidence.shoulderAgreement < 0.9) throw new Error("Rig khác calibration CMU +Z; cần hiệu chỉnh có chủ ý, không đoán front.");
  return { id: "cmu-111_05-hips-shoulders-toes-v1", localForward: [0, 0, 1], up: "+Y", angleConvention: "radians internally; degrees telemetry; atan2(x,z); positive +Z toward +X", evidence, desiredStageHeadingDeg: degrees(STAGE_FRONT), cameraOrbitAffectsHeading: false };
}
