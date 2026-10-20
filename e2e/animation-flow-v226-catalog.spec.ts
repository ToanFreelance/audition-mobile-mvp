import { expect, test } from "@playwright/test";
import {
  DANCE_REVIEW_CANDIDATES, NORMAL_PHRASES, SOURCE_IDS, SOURCE_PIN,
} from "../lib/animation-flow-v2/catalog";
import { MODERN_GAMEPLAY_PHRASES, LEGACY_QA_PHRASES } from "../lib/animation-flow-v2/style-policy";

test("V2.2.6 adds six verified-source surveys, not six approved animations", () => {
  expect(SOURCE_PIN).toBe("09a07f54f3bbb58797325f009282d0b2048a2871");
  expect(DANCE_REVIEW_CANDIDATES.map(p => p.source))
    .toEqual(["85_01", "85_02", "85_04", "85_12", "85_14", "90_28"]);
  expect(DANCE_REVIEW_CANDIDATES.every(p => p.acceptance === "technical-preview-pending")).toBe(true);
  expect(DANCE_REVIEW_CANDIDATES.every(p => p.tempoBasis === "testing-assumption")).toBe(true);
  expect(DANCE_REVIEW_CANDIDATES.every(p => p.end > p.start && Math.abs((p.end - p.start) - 3.2) < 1e-7)).toBe(true);
  expect(DANCE_REVIEW_CANDIDATES.every(p => SOURCE_IDS.includes(p.source))).toBe(true);
});

test("Review clip sources cannot leak to gameplay shuffle or Finish/REST", () => {
  const ids = new Set(NORMAL_PHRASES.map(p => p.id));
  expect(NORMAL_PHRASES).toHaveLength(16);
  expect(MODERN_GAMEPLAY_PHRASES).toHaveLength(11);
  expect(LEGACY_QA_PHRASES).toHaveLength(5);
  expect(DANCE_REVIEW_CANDIDATES.every(p => !ids.has(p.id))).toBe(true);
  expect(DANCE_REVIEW_CANDIDATES.filter(p => p.role === "fixture").map(p => p.source)).toEqual(["85_14","90_28"]);
  expect(DANCE_REVIEW_CANDIDATES.filter(p => p.role === "fixture").every(p => p.policy === "PROTECTED")).toBe(true);
});
