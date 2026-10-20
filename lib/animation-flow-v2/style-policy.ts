/** QA-only dance-style taxonomy. Never changes the production Character Catalog. */
import { NORMAL_PHRASES, type PhraseSpec } from "./catalog";

export type DanceFamily = "street" | "pop" | "swing" | "social" | "novelty";
export type ModernFamily = "street" | "pop";

/**
 * Explicitly curated from current source descriptions. Unknown/"descriptive"
 * CMU motions are technical candidates; iPhone visual approval is still needed.
 * These IDs are source phrases, not published runtime character assets.
 */
export const PHRASE_DANCE_FAMILY: Readonly<Record<string, DanceFamily>> = {
  "111-groove": "pop",
  "141-twist": "pop",
  "93-charleston": "swing",
  "143-party": "pop",
  "120-mickey": "pop",
  "85-upright": "street",
  "55-lambada": "social",
  "55-bear": "novelty",
  "85-toprock": "street",
  "93-fancy": "swing",
  "94-knee-open": "street",
  "94-diagonal": "street",
  "94-point": "pop",
  "94-pulse": "street",
  "143-chicken": "novelty",
  "90-glide": "street",
};
export const DEFAULT_STYLE_RUN_SPACES = 3;
export function phraseFamily(phrase: Pick<PhraseSpec, "id"> | null | undefined): DanceFamily | null {
  if (phrase?.id.startsWith("break-85-") || phrase?.id.startsWith("break-90-")) return "street";
  return phrase ? PHRASE_DANCE_FAMILY[phrase.id] ?? null : null;
}
export function isModernFamily(family: DanceFamily | null): family is ModernFamily {
  return family === "street" || family === "pop";
}
export const MODERN_GAMEPLAY_PHRASES = NORMAL_PHRASES.filter(p => isModernFamily(phraseFamily(p)));
export const LEGACY_QA_PHRASES = NORMAL_PHRASES.filter(p => !isModernFamily(phraseFamily(p)));
export function otherModernFamily(family: ModernFamily): ModernFamily {
  return family === "street" ? "pop" : "street";
}
export function assertCompleteStyleCatalog(): void {
  const ids = NORMAL_PHRASES.map(p => p.id);
  const missing = ids.filter(id => !PHRASE_DANCE_FAMILY[id]);
  const stale = Object.keys(PHRASE_DANCE_FAMILY).filter(id => !ids.includes(id));
  if (missing.length || stale.length)
    throw new Error("Animation style catalog mismatch: missing=" + missing.join(",") + " stale=" + stale.join(","));
}
