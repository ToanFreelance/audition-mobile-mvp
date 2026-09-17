import type { Judgement } from "../game/types";
import { deriveDeterministicSeed } from "./determinism";
import type { BotProfile } from "./types";

const MIXED_OUTCOMES: readonly Judgement[] = ["perfect", "great", "cool", "bad", "miss"];

export function resolveBotJudgement(
  profile: BotProfile,
  matchSeed: number,
  participantId: string,
  absoluteTurn: number,
): Judgement {
  if (profile === "perfect") return "perfect";
  if (profile === "miss" || profile === "passive") return "miss";
  const seed = deriveDeterministicSeed(matchSeed, absoluteTurn, `bot:${participantId}`);
  return MIXED_OUTCOMES[seed % MIXED_OUTCOMES.length];
}
