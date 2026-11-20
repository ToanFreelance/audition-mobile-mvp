import { expect, test } from "@playwright/test";
import {
  compatibleBagIndex, createMixamoContactTracker, plantedFeet,
  supportFootMismatch, transitionWindow, type FootPair,
} from "../components/character/mixamo-contact-transitions";

test("V4 every blend completes before the outgoing one-shot ends", () => {
  for (const duration of [0.21, 0.45, 0.8, 1.2, 3.5, 10.67]) {
    const { fade, lead } = transitionWindow(duration);
    expect(fade).toBeGreaterThan(0);
    expect(lead).toBeGreaterThanOrEqual(fade);
    expect(lead).toBeLessThan(duration);
    // The previous bug was 550ms fade with just 320ms of available clip.
    expect(fade).toBeLessThanOrEqual(lead);
    expect(duration - lead).toBeGreaterThanOrEqual(0);
  }
});

test("V4 chooses the support-foot-compatible start, not a drifting shoe", () => {
  const current: FootPair = [[0, 0, 0], [0.2, 0, 0]];
  const far: FootPair = [[0.16, 0, 0], [0.2, 0, 0]];
  const near: FootPair = [[0.002, 0, 0], [-0.08, 0.11, 0]];
  const starts = new Map([["far", far], ["near", near]]);
  expect(supportFootMismatch(current, near, [true, false], 1.6))
    .toBeLessThan(supportFootMismatch(current, far, [true, false], 1.6));
  expect(compatibleBagIndex(["far", "near"], starts, current, [true, false], 1.6, [])).toBe(1);
  expect(compatibleBagIndex(["far", "near"], starts, current, [true, false], 1.6, ["near"])).toBe(0);
  expect(compatibleBagIndex([], starts, current, [true, true], 1.6, [])).toBe(-1);
  // Near-identical starts keep existing deterministic shuffle-bag ordering.
  starts.set("far", [[0, 0, 0], [0.2, 0, 0]]);
  expect(compatibleBagIndex(["far", "near"], starts, current, [true, false], 1.6, [])).toBe(0);
});

test("V4 records contact drift only near ground and attributes crossfade separately", () => {
  const tracker = createMixamoContactTracker([0, 0], 1.6);
  const a: FootPair = [[0, 0, 0], [0.2, 0.10, 0]];
  const b: FootPair = [[0.025, 0, 0], [0.2, 0.09, 0]];
  const c: FootPair = [[0.050, 0, 0], [0.2, 0.08, 0]];
  expect(plantedFeet(a, [0, 0], 1.6)).toEqual([true, false]);
  tracker.update(a, false, 1 / 60);
  tracker.update(b, false, 1 / 60);
  expect(tracker.stats.maxContactSlip).toBeCloseTo(0.025, 5);
  expect(tracker.stats.maxCrossfadeSlip).toBe(0);
  tracker.update(c, true, 1 / 60);
  expect(tracker.stats.maxContactSlip).toBeCloseTo(0.05, 5);
  expect(tracker.stats.maxCrossfadeSlip).toBeCloseTo(0.05, 5);
  expect(tracker.stats.crossfadeTravel).toBeCloseTo(0.025, 5);
  tracker.update([[0.2, 0.10, 0], [0.2, 0.10, 0]], false, 1 / 60);
  tracker.update([[0.3, 0, 0], [0.2, 0.10, 0]], false, 1 / 60);
  // Lift resets the contact anchor; that deliberate step is not counted as slide.
  expect(tracker.stats.maxContactSlip).toBeCloseTo(0.05, 5);
});

test("V4 full M3 mesh: contact diagnostics, original actor identity and A/B flag", async ({page}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({width: 390, height: 844});
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/tools/lobby-qa-sketch?m3=female&mixamo=1&contactV4=1");
  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready", "1", {timeout: 100_000});
  await expect(stage).toHaveAttribute("data-m3-contact-v4", "1", {timeout: 10_000});
  const before = await stage.getAttribute("data-m3-idle-instances");
  const scene = await stage.getAttribute("data-scene-generation");
  await page.getByLabel("Động tác").selectOption("bored");
  await page.getByRole("button", {name: "Phát lại", exact: true}).click();
  await expect(stage).toHaveAttribute("data-m3-reference-profiles", "bored");
  await page.waitForTimeout(1500);
  const metrics = await stage.evaluate(el => JSON.parse(el.dataset.m3ContactMetrics ?? "[]"));
  expect(metrics).toHaveLength(1);
  expect(Number.isFinite(metrics[0].contactSlip)).toBe(true);
  expect(Number.isFinite(metrics[0].crossfadeSlip)).toBe(true);
  expect(Number.isFinite(metrics[0].poseGap)).toBe(true);
  await expect(stage).toHaveAttribute("data-m3-idle-instances", before!);
  await expect(stage).toHaveAttribute("data-scene-generation", scene!);
  expect(errors).toEqual([]);
});
