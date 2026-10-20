import { expect, test } from "@playwright/test";
import { NORMAL_PHRASES } from "../lib/animation-flow-v2/catalog";
import {
  assertCompleteStyleCatalog, DEFAULT_STYLE_RUN_SPACES,
  isModernFamily, LEGACY_QA_PHRASES, MODERN_GAMEPLAY_PHRASES,
  otherModernFamily, phraseFamily,
} from "../lib/animation-flow-v2/style-policy";

test("All 16 QA phrases have explicit non-production dance families", () => {
  expect(() => assertCompleteStyleCatalog()).not.toThrow();
  expect(NORMAL_PHRASES).toHaveLength(16);
  expect(MODERN_GAMEPLAY_PHRASES).toHaveLength(11);
  expect(LEGACY_QA_PHRASES).toHaveLength(5);
  expect(new Set([...MODERN_GAMEPLAY_PHRASES, ...LEGACY_QA_PHRASES].map(p => p.id)).size).toBe(16);
  expect(MODERN_GAMEPLAY_PHRASES.every(p => isModernFamily(phraseFamily(p)))).toBe(true);
});

test("Swing, social and novelty are retained in QA catalog, never default gameplay", () => {
  for (const id of ["93-charleston", "93-fancy", "55-lambada", "55-bear", "143-chicken"]) {
    expect(LEGACY_QA_PHRASES.map(p => p.id)).toContain(id);
    expect(MODERN_GAMEPLAY_PHRASES.map(p => p.id)).not.toContain(id);
  }
  expect(MODERN_GAMEPLAY_PHRASES.map(p => p.id)).toContain("85-toprock");
  expect(MODERN_GAMEPLAY_PHRASES.map(p => p.id)).toContain("141-twist");
  expect(MODERN_GAMEPLAY_PHRASES.map(p => p.id)).toContain("90-glide");
});

test("Only modern Street and Pop families form gameplay chapters", () => {
  const familyCounts = MODERN_GAMEPLAY_PHRASES.reduce((out, p) => {
    const family = phraseFamily(p);
    if (family) out[family] = (out[family] ?? 0) + 1;
    return out;
  }, {} as Record<string, number>);
  expect(familyCounts).toEqual({ pop: 5, street: 6 });
  expect(DEFAULT_STYLE_RUN_SPACES).toBe(3);
  expect(otherModernFamily("street")).toBe("pop");
  expect(otherModernFamily("pop")).toBe("street");
});
