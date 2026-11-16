import { expect, test } from "@playwright/test";

/**
 * Actual assembled M3 SkinnedMesh browser smoke, not a synthetic skeleton.
 * Screenshots are *evidence for manual review*, never automatic aesthetic pass.
 * This fixture never creates Supabase rooms or modifies game state.
 */
for (const fixture of [
  { query: "female", expectedActors: "1", m3Count: "1", profile: "female-relaxed-greeting" },
  { query: "male", expectedActors: "1", m3Count: "1", profile: "male-neck-led-slump" },
  { query: "five", expectedActors: "5", m3Count: "3", profile: "male-neck-led-slump" },
]) {
  test("V1.7 actual M3 render smoke: " + fixture.query, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/tools/lobby-qa-sketch?m3=" + fixture.query);
    const stage = page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 100_000 });
    await expect(stage).toHaveAttribute("data-actor-count", fixture.expectedActors);
    await expect(stage).toHaveAttribute("data-m3-idle-count", fixture.m3Count);
    await expect(stage).toHaveAttribute("data-m3-reference-profiles", new RegExp(fixture.profile), { timeout: 30_000 });
    const before = await stage.getAttribute("data-scene-generation");
    if (fixture.query === "five") {
      const instances = await stage.getAttribute("data-m3-idle-instances");
      expect(instances?.split(",")).toHaveLength(3);
      await expect(stage).toHaveAttribute("data-idle-count", "2");
      await page.getByTestId("room-settings-button").click();
      await page.getByRole("button", {name: "GUEST", exact: true}).first().click();
      await page.getByTestId("room-settings-button").click();
      const ready = page.getByTestId("ready-button");
      await ready.click();
      await expect(ready).toContainText("ĐÃ SẴN SÀNG");
      await ready.click();
      await expect(ready).not.toContainText("ĐÃ SẴN SÀNG");
      await page.waitForTimeout(650); // Allow the existing sketch telemetry tick to publish.
      await expect(stage).toHaveAttribute("data-m3-idle-instances", instances!);
    }
    const capturePrefix = "test-results/m3-idle-v17/" + fixture.query;
    await page.screenshot({ path: capturePrefix + "-initial.png", fullPage: false, animations: "disabled" });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: capturePrefix + "-progress.png", fullPage: false, animations: "disabled" });
    const metrics = await stage.evaluate(element => ({
      profiles: element.getAttribute("data-m3-reference-profiles"),
      times: element.getAttribute("data-m3-reference-times"),
      drift: Number(element.getAttribute("data-m3-foot-drift")),
      sceneGeneration: element.getAttribute("data-scene-generation"),
      active: element.getAttribute("data-m3-active-gestures"),
    }));
    console.log("M3_V17_MESH_SMOKE " + fixture.query + " " + JSON.stringify(metrics));
    expect(Number.isFinite(metrics.drift)).toBe(true);
    expect(metrics.drift).toBeLessThan(.015);
    expect(metrics.sceneGeneration).toBe(before);
    expect(errors).toEqual([]);
  });
}
