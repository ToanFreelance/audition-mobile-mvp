import { expect, test } from "@playwright/test";

type ContactMetric = {
  lockedFeet: number;
  maxContactError: number;
  contactTravel: number;
  plantedRawTravel: number;
  plantedCorrectedTravel: number;
};

/** Real M3 mesh / Five-person Waiting Room renderer, no synthetic rig. */
for (const family of ["female", "male"] as const) {
  test(`Mixamo V2: measure planted-foot travel before vs after IK — ${family}`, async ({ page }) => {
    test.setTimeout(160_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/tools/lobby-qa-sketch?m3=${family}&mixamo=1&footLock=1`);
    const stage = page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 110_000 });
    await expect(stage).toHaveAttribute("data-m3-idle-count", "1", { timeout: 30_000 });
    const original = await stage.getAttribute("data-m3-idle-instances");
    await page.getByLabel("Động tác").selectOption("breathing-idle-2");
    await page.getByRole("button", { name: "Phát lại", exact: true }).click();
    await page.waitForTimeout(6500);
    const afterBreathing = await stage.evaluate(el => JSON.parse(el.dataset.m3FootlockMetrics ?? "[]") as ContactMetric[]);
    expect(afterBreathing).toHaveLength(1);
    expect(afterBreathing[0].plantedRawTravel).toBeGreaterThanOrEqual(0);
    expect(afterBreathing[0].plantedCorrectedTravel).toBeGreaterThanOrEqual(0);
    // Compare distances *while the same foot is locked*, not displacement from
    // the T-pose or a deliberate animated step.
    expect(afterBreathing[0].plantedCorrectedTravel).toBeLessThanOrEqual(
      afterBreathing[0].plantedRawTravel * 1.08 + 0.006,
    );
    await page.getByLabel("Động tác").selectOption("bored");
    await page.getByRole("button", { name: "Phát lại", exact: true }).click();
    await page.waitForTimeout(3800);
    const afterBored = await stage.evaluate(el => JSON.parse(el.dataset.m3FootlockMetrics ?? "[]") as ContactMetric[]);
    expect(afterBored).toHaveLength(1);
    expect(Object.values(afterBored[0]).every(Number.isFinite)).toBe(true);
    expect(afterBored[0].plantedCorrectedTravel).toBeLessThanOrEqual(
      afterBored[0].plantedRawTravel * 1.08 + 0.008,
    );
    await expect(stage).toHaveAttribute("data-m3-idle-instances", original!);
    console.log("MIXAMO_FOOT_V2_" + family.toUpperCase() + " " + JSON.stringify({ afterBreathing, afterBored }));
    expect(errors).toEqual([]);
  });
}