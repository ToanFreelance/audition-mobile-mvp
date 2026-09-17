import type * as THREE from "three";

const IDLE_SELECTION_NAMESPACE = "audition-lobby-idle-v2";

type IdleParticipantIdentity = {
  participantId: string;
  slotIndex: number;
};

/**
 * Allocate pseudo-random idle clips across the current room roster while avoiding
 * visible clone behavior. Each participant gets its own deterministic preference
 * order. Occupied participants are resolved by slot order; as long as the pool has
 * unused clips, collisions are avoided. Once participant count exceeds pool size,
 * duplicates are allowed again.
 */
export function selectRoomParticipantIdleIndices(
  participants: readonly IdleParticipantIdentity[],
  poolSize: number,
  releaseVersion: number,
  roomId: string,
) {
  const assignments = new Map<string, number>();
  if (poolSize <= 0) return assignments;

  const orderedParticipants = [...participants].sort(
    (a, b) => a.slotIndex - b.slotIndex || a.participantId.localeCompare(b.participantId),
  );
  const used = new Set<number>();

  for (const participant of orderedParticipants) {
    const preferenceOrder = deterministicClipOrder(
      poolSize,
      stableHash32(`${IDLE_SELECTION_NAMESPACE}|clip-order|${roomId}|${releaseVersion}|${participant.participantId}`),
    );
    const chosen = used.size < poolSize
      ? preferenceOrder.find(index => !used.has(index)) ?? preferenceOrder[0]
      : preferenceOrder[0];
    assignments.set(participant.participantId, chosen);
    if (used.size < poolSize) used.add(chosen);
  }

  return assignments;
}

export function selectParticipantIdleClipByIndex(
  clips: readonly THREE.AnimationClip[],
  index: number,
) {
  return index >= 0 ? clips[index] ?? null : null;
}

export function selectParticipantIdlePhaseSeconds(
  participantId: string,
  clipDurationSeconds: number,
  releaseVersion: number,
  roomId = "",
) {
  if (!(clipDurationSeconds > 0)) return 0;
  const value = stableHash32(
    `${IDLE_SELECTION_NAMESPACE}|phase|${roomId}|${releaseVersion}|${participantId}`,
  ) / 0x1_0000_0000;
  return value * clipDurationSeconds;
}

function deterministicClipOrder(poolSize: number, seed: number) {
  const order = Array.from({ length: poolSize }, (_, index) => index);
  let state = seed || 0x9e3779b9;
  for (let index = order.length - 1; index > 0; index -= 1) {
    state = xorshift32(state);
    const swapIndex = state % (index + 1);
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}

function xorshift32(value: number) {
  let state = value >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

function stableHash32(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
