import type { Judgement, JudgementMeta } from "../../game/types";
import type { CharacterChoreographyId, CharacterPresentationEvent } from "./character-types";

export const NORMAL_CHOREOGRAPHY_POOL = [
  "dance",
  "wave",
  "yes",
  "punch",
  "walk-jump",
  "thumbs-up",
] as const satisfies readonly CharacterChoreographyId[];
export const FINISH_CHOREOGRAPHY: CharacterChoreographyId = "finish-jump";

export function selectCharacterChoreography(
  seed: number | undefined,
  absoluteTurn: number,
  isFinish: boolean,
): CharacterChoreographyId {
  if (isFinish) return FINISH_CHOREOGRAPHY;
  const stableSeed = Number.isFinite(seed) ? (seed as number) | 0 : 0;
  const seedOffset = (Math.imul(stableSeed ^ 0x6d2b79f5, 0x1b873593) >>> 0) % NORMAL_CHOREOGRAPHY_POOL.length;
  const index = ((absoluteTurn % NORMAL_CHOREOGRAPHY_POOL.length) + seedOffset + NORMAL_CHOREOGRAPHY_POOL.length)
    % NORMAL_CHOREOGRAPHY_POOL.length;
  return NORMAL_CHOREOGRAPHY_POOL[index];
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
  };
}
