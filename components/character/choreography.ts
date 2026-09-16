import type { Judgement, JudgementMeta } from "../../game/types";
import type { CharacterChoreographyId, CharacterPresentationEvent } from "./character-types";

export const NORMAL_CHOREOGRAPHY_POOL = [
  "dance-01",
  "dance-02",
  "dance-03",
  "dance-04",
  "dance-05",
  "dance-06",
  "dance-07",
  "dance-08",
] as const satisfies readonly CharacterChoreographyId[];
export const FINISH_CHOREOGRAPHY: CharacterChoreographyId = "finish-special";

function stableSeedValue(seed: number | undefined) {
  return Number.isFinite(seed) ? (seed as number) | 0 : 0;
}

export function selectCharacterChoreography(
  seed: number | undefined,
  absoluteTurn: number,
  isFinish: boolean,
): CharacterChoreographyId {
  if (isFinish) return FINISH_CHOREOGRAPHY;
  const stableSeed = stableSeedValue(seed);
  const seedOffset = (Math.imul(stableSeed ^ 0x6d2b79f5, 0x1b873593) >>> 0) % NORMAL_CHOREOGRAPHY_POOL.length;
  const index = ((absoluteTurn % NORMAL_CHOREOGRAPHY_POOL.length) + seedOffset + NORMAL_CHOREOGRAPHY_POOL.length)
    % NORMAL_CHOREOGRAPHY_POOL.length;
  return NORMAL_CHOREOGRAPHY_POOL[index];
}

/**
 * Produces a stable random-looking 32-bit key for presentation variants.
 * Runtime maps this key onto the currently published Final Dance pool size.
 * No gameplay timing/state is read or changed here.
 */
export function selectFinalDanceVariantKey(seed: number | undefined, absoluteTurn: number) {
  const stableSeed = stableSeedValue(seed) >>> 0;
  let value = (stableSeed ^ Math.imul(absoluteTurn | 0, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

export function createCharacterPresentationEvent(
  eventId: number,
  judgement: Judgement,
  meta: JudgementMeta,
  seed?: number,
): CharacterPresentationEvent {
  const shared = {
    eventId,
    absoluteTurn: meta.absoluteTurn,
    level: meta.level,
    isFinish: meta.isFinish,
    actionStartSongTimeMs: meta.atMs,
  };

  if (judgement === "bad" || judgement === "miss") {
    return { ...shared, kind: "fail", judgement };
  }

  return {
    ...shared,
    kind: "dance",
    judgement,
    choreographyId: selectCharacterChoreography(seed, meta.absoluteTurn, meta.isFinish),
    presentationVariantKey: meta.isFinish
      ? selectFinalDanceVariantKey(seed, meta.absoluteTurn)
      : undefined,
  };
}
