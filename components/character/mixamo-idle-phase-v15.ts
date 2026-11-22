/**
 * Five-person Waiting Room Mixamo QA: keep the same gestures available for
 * random selection without letting two matching clips play in lockstep.
 *
 * Animation selection remains the existing per-actor shuffle bag. We offset
 * only an *automatically* started action whose gesture is already active on
 * another actor. Manual "play on all five" QA must still start at source t=0.
 * No realtime messages, global clock or runtime bone corrections are involved.
 */
export type ActiveMixamoPhase = {
  id: string;
  time: number;
};

export function chooseUnsyncedMixamoStart(
  gesture: string,
  clipDuration: number,
  peers: readonly ActiveMixamoPhase[],
): number {
  if (!Number.isFinite(clipDuration) || clipDuration <= 0) return 0;
  const occupied = peers
    .filter(peer => peer.id === gesture && Number.isFinite(peer.time))
    .map(peer => Math.max(0, peer.time));
  if (!occupied.length) return 0;

  // Existing clips can be as short as ~5s; avoid seeking into the ending
  // transition. Five matching actors can still occupy five different phases.
  const step = Math.min(0.52, Math.max(0.18, clipDuration * 0.105));
  const limit = Math.min(2.3, clipDuration * 0.43);
  const minGap = Math.min(step * 0.75, 0.33);
  let best = 0;
  let largestClearance = -1;
  for (let candidate = 0; candidate <= limit + 1e-5; candidate += step) {
    const phase = Math.min(candidate, limit);
    const clearance = Math.min(...occupied.map(other => Math.abs(other - phase)));
    if (clearance >= minGap) return Math.round(phase * 1000) / 1000;
    if (clearance > largestClearance) {
      largestClearance = clearance;
      best = phase;
    }
  }
  // Defensive fallback when more actors share a very short clip than can
  // fit our conservative phase slots. Still maximize temporal separation.
  return Math.round(best * 1000) / 1000;
}
