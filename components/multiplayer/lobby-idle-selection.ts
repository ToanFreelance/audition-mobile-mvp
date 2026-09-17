import type * as THREE from "three";

const IDLE_SELECTION_NAMESPACE = "audition-lobby-idle-v1";

export function selectParticipantIdleIndex(
  participantId: string,
  poolSize: number,
  releaseVersion: number,
) {
  if (poolSize <= 0) return -1;
  return stableHash32(`${IDLE_SELECTION_NAMESPACE}|clip|${releaseVersion}|${participantId}`) % poolSize;
}

export function selectParticipantIdleClip(
  clips: readonly THREE.AnimationClip[],
  participantId: string,
  releaseVersion: number,
) {
  const index = selectParticipantIdleIndex(participantId, clips.length, releaseVersion);
  return index >= 0 ? clips[index] ?? null : null;
}

export function selectParticipantIdlePhaseSeconds(
  participantId: string,
  clipDurationSeconds: number,
  releaseVersion: number,
) {
  if (!(clipDurationSeconds > 0)) return 0;
  const value = stableHash32(`${IDLE_SELECTION_NAMESPACE}|phase|${releaseVersion}|${participantId}`) / 0x1_0000_0000;
  return value * clipDurationSeconds;
}

function stableHash32(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
