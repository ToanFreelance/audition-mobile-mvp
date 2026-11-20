import { expect, test } from "@playwright/test";
import {
  BORED_PELVIS_CAP_METERS,
  BORED_PELVIS_FRAMES,
  applyBoredPelvisCorrection,
  getBoredPelvisOffset,
} from "../components/character/mixamo-pelvis-stabilizer";

for (const family of ["drophunter", "neurohacker"] as const) {
  test(`V3 ${family}: pelvis-only source-derived correction has bounded, loop-safe translation`, () => {
    const hipPositions = new Float32Array(BORED_PELVIS_FRAMES * 3);
    for (let k = 0; k < BORED_PELVIS_FRAMES; k++) {
      hipPositions[k * 3] = 0.012;
      hipPositions[k * 3 + 1] = 0.8 + Math.sin(k / 30) * 0.03;
      hipPositions[k * 3 + 2] = -0.006;
    }
    const original = hipPositions.slice();
    expect(applyBoredPelvisCorrection(family, "breathing-idle-2", hipPositions, BORED_PELVIS_FRAMES)).toBe(false);
    expect(Array.from(hipPositions)).toEqual(Array.from(original));
    expect(applyBoredPelvisCorrection(family, "bored", hipPositions, BORED_PELVIS_FRAMES)).toBe(true);
    let maximum = 0;
    let largestStep = 0;
    for (let i = 0; i < BORED_PELVIS_FRAMES; i++) {
      const [x, z] = getBoredPelvisOffset(family, i);
      const current = Math.hypot(x, z);
      maximum = Math.max(maximum, current);
      expect(hipPositions[i * 3 + 1]).toBe(original[i * 3 + 1]); // Never alter hip height.
      expect(hipPositions[i * 3]).toBeCloseTo(original[i * 3] + x, 5);
      expect(hipPositions[i * 3 + 2]).toBeCloseTo(original[i * 3 + 2] + z, 5);
      if (i > 0) {
        const [px, pz] = getBoredPelvisOffset(family, i - 1);
        largestStep = Math.max(largestStep, Math.hypot(x - px, z - pz));
      }
    }
    expect(maximum).toBeLessThanOrEqual(BORED_PELVIS_CAP_METERS + 0.0001);
    expect(largestStep).toBeLessThan(0.0035); // no one-frame actor jump
    expect(getBoredPelvisOffset(family, 0)).toEqual([0, 0]);
    expect(getBoredPelvisOffset(family, BORED_PELVIS_FRAMES - 1)).toEqual([0, 0]);
    // All limb tracks and the body orientation remain untouched by this function.
  });
}

for (const family of ["female", "male"] as const) {
  test(`V3 ${family}: actual M3 lobby mesh plays Bored pelvis correction without actor recreation`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", err => errors.push(err.message));
    await page.goto(`/tools/lobby-qa-sketch?m3=${family}&mixamo=1&pelvisFix=1`);
    const stage = page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 90_000 });
    await expect(stage).toHaveAttribute("data-m3-idle-count", "1", { timeout: 30_000 });
    await expect(stage).toHaveAttribute("data-m3-footlock-enabled", "0");
    const instance = await stage.getAttribute("data-m3-idle-instances");
    const generation = await stage.getAttribute("data-scene-generation");
    await page.getByLabel("Động tác").selectOption("bored");
    await page.getByRole("button", { name: "Phát lại", exact: true }).click();
    await expect(stage).toHaveAttribute("data-m3-reference-profiles", "bored", { timeout: 30_000 });
    await page.waitForTimeout(1400);
    await expect(stage).toHaveAttribute("data-m3-idle-instances", instance!);
    await expect(stage).toHaveAttribute("data-scene-generation", generation!);
    await page.screenshot({ path: `test-results/mixamo-pelvis-v3/${family}.png` });
    expect(errors).toEqual([]);
  });
}