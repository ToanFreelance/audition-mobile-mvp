import { expect, test } from "@playwright/test";

/**
 * Actual assembled M3 SkinnedMesh browser smoke, not a synthetic skeleton.
 * Screenshots are *evidence for manual review*, never automatic aesthetic pass.
 * This fixture never creates Supabase rooms or modifies game state.
 */
for (const fixture of [
  { query: "female", expectedActors: "1", m3Count: "1", profile: "F0[1-5]" },
  { query: "male", expectedActors: "1", m3Count: "1", profile: "[MX]0[1-3]" },
  { query: "five", expectedActors: "5", m3Count: "3", profile: "[MX]0[1-3]" },
]) {
  test("V1.8 actual M3 render smoke: " + fixture.query, async ({ page }) => {
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
    if (fixture.query !== "five") {
      await page.getByText("Kiểm tra chuyển động M3").click();
      const id = fixture.query === "female" ? "F03" : "M03";
      await page.getByLabel("Động tác").selectOption(id);
      await page.getByRole("button", {name:"Phát lại", exact:true}).click();
      await expect(stage).toHaveAttribute("data-m3-reference-profiles", id);
      await page.getByRole("button", {name:"Góc nghiêng", exact:true}).click();
      await page.getByRole("button", {name:"0,25×", exact:true}).click();
      await page.getByRole("button", {name:"Chính diện", exact:true}).click();
      await page.getByRole("button", {name:"1×", exact:true}).click();
      await page.getByLabel("Động tác").selectOption(fixture.query === "female" ? "F02" : "M01");
      await page.getByRole("button", {name:"Chuyển đến", exact:true}).click();
      await expect(stage).toHaveAttribute("data-m3-reference-profiles", fixture.query === "female" ? "F02" : "M01", {timeout:30000});
      await page.getByRole("button", {name:"Ngẫu nhiên", exact:true}).click();
      await page.getByText("Kiểm tra chuyển động M3").click();
    }
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
    const capturePrefix = "test-results/m3-idle-v18/" + fixture.query;
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
    console.log("M3_V18_MESH_SMOKE " + fixture.query + " " + JSON.stringify(metrics));
    expect(Number.isFinite(metrics.drift)).toBe(true);
    expect(metrics.drift).toBeLessThan(.015);
    expect(metrics.sceneGeneration).toBe(before);
    expect(errors).toEqual([]);
  });
}
