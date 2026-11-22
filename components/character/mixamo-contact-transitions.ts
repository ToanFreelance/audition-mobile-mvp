/**
 * Mixamo Waiting Room QA: foot-contact diagnostics and pose-aware shuffle-bag
 * selection. This module NEVER modifies animation joints or the actor transform.
 * All measurements use M3 actor-local coordinates (meters).
 */
export type FootPoint = readonly [number, number, number]; // x, y, z
export type FootPair = readonly [FootPoint, FootPoint]; // left, right
export type ContactMask = readonly [boolean, boolean];

export function plantedFeet(
  feet: FootPair, restY: readonly [number, number], characterHeight: number,
): ContactMask {
  const epsilon = Math.max(0.012, characterHeight * 0.021);
  return [
    feet[0][1] - restY[0] <= epsilon,
    feet[1][1] - restY[1] <= epsilon,
  ];
}

/** Fade MUST finish while the outgoing one-shot is still playing. */
export function transitionWindow(clipDuration: number): { fade: number; lead: number } {
  if (!Number.isFinite(clipDuration) || clipDuration <= 0) throw new Error("Invalid Mixamo clip duration");
  const fade = Math.min(0.28, Math.max(0.09, clipDuration * 0.22), clipDuration * 0.4);
  // 120ms scheduling margin covers one bounded 100ms mixer step.
  const lead = Math.min(clipDuration * 0.7, fade + 0.12);
  return { fade, lead };
}

/** Compare support-foot positions, not cosmetic/world-space actor transforms. */
export function supportFootMismatch(
  current: FootPair, candidate: FootPair, contacts: ContactMask, height: number,
): number {
  let total = 0;
  let weights = 0;
  for (let i = 0; i < 2; i++) {
    const weight = contacts[i] ? 1 : 0.12;
    const dx = current[i][0] - candidate[i][0];
    const dz = current[i][2] - candidate[i][2];
    const dy = current[i][1] - candidate[i][1];
    total += weight * (Math.hypot(dx, dz) + 0.3 * Math.abs(dy));
    weights += weight;
  }
  return total / Math.max(weights, 1e-6) / Math.max(height, 1e-6);
}

/**
 * Prefer a start pose compatible with the currently supporting foot, but
 * preserve seeded shuffle-bag order for near-ties. No clip is removed here.
 */
export function compatibleBagIndex<K extends string>(
  bag: readonly K[],
  starts: ReadonlyMap<K, FootPair>,
  current: FootPair, contacts: ContactMask, height: number,
  prohibited: readonly K[],
): number {
  const eligible = bag.map((name, index) => ({name, index}))
    .filter(item => !prohibited.includes(item.name));
  const candidates = eligible.length ? eligible : bag.map((name, index) => ({name, index}));
  if (!candidates.length) return -1;
  const first = candidates[0];
  let selected = first.index;
  const initial = starts.get(first.name);
  let best = initial ? supportFootMismatch(current, initial, contacts, height) : Infinity;
  for (const item of candidates.slice(1)) {
    const pose = starts.get(item.name);
    if (!pose) continue;
    const score = supportFootMismatch(current, pose, contacts, height);
    // Ignore sub-centimeter gains to keep seeded random diversity.
    if (score < best - 0.007) { best = score; selected = item.index; }
  }
  return selected;
}

export function createMixamoContactTracker(
  restY: readonly [number, number], characterHeight: number,
) {
  const anchor: (FootPoint | null)[] = [null, null];
  const previous: (FootPoint | null)[] = [null, null];
  const stats = {
    maxContactSlip: 0, maxCrossfadeSlip: 0,
    plantedTravel: 0, crossfadeTravel: 0,
    contactFrames: 0, crossfadeContactFrames: 0,
  };
  return {
    stats,
    resetAnchors() {
      anchor[0] = anchor[1] = null;
      previous[0] = previous[1] = null;
    },
    update(feet: FootPair, inCrossfade: boolean, deltaSeconds: number): ContactMask {
      const mask = plantedFeet(feet, restY, characterHeight);
      if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 0.25) {
        this.resetAnchors();
        return mask;
      }
      for (let i = 0; i < 2; i++) {
        if (!mask[i]) {
          anchor[i] = null;
          previous[i] = null;
          continue;
        }
        const p = feet[i];
        if (!anchor[i]) anchor[i] = p;
        if (previous[i]) {
          const travel = Math.hypot(p[0] - previous[i]![0], p[2] - previous[i]![2]);
          stats.plantedTravel += travel;
          if (inCrossfade) stats.crossfadeTravel += travel;
        }
        const slip = Math.hypot(p[0] - anchor[i]![0], p[2] - anchor[i]![2]);
        stats.maxContactSlip = Math.max(stats.maxContactSlip, slip);
        if (inCrossfade) {
          stats.maxCrossfadeSlip = Math.max(stats.maxCrossfadeSlip, slip);
          stats.crossfadeContactFrames++;
        }
        stats.contactFrames++;
        previous[i] = p;
      }
      return mask;
    },
  };
}
