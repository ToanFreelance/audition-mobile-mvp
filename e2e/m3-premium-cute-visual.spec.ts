import { expect, test } from "@playwright/test";

/**
 * Actual WebGL + assembled VRM smoke for the Premium Cute Anime material/lighting
 * candidate. A snapshot is review evidence only, not owner artistic acceptance.
 */
test("M3 premium creator shows both real rigs without breaking saved traits", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/character/create");
  const stage = page.getByTestId("c2-character-stage");
  await page.getByRole("button", { name: "Tạo hình" }).click();

  for (const [family, gender] of [
    ["m3-drophunter", "female"],
    ["m3-neurohacker", "male"],
  ] as const) {
    await page.getByTestId("creator-gender-" + gender).click();
    await expect(stage).toHaveAttribute("data-character-asset-id", family);
    await expect(stage).toHaveAttribute("data-preview-state", "ready", { timeout: 110_000 });
    await expect.poll(async () => Number(await stage.getAttribute("data-m3-premium-materials"))).toBeGreaterThan(0);
    // The source VRMs are unlit: assert that real materials, not only lights,
    // were converted to responsive PBR on each M3 rig.
    await expect.poll(async () => Number(await stage.getAttribute("data-m3-premium-converted"))).toBeGreaterThan(0);
    await expect.poll(async () => Number(await stage.getAttribute("data-m3-premium-physical-details"))).toBeGreaterThan(0);
    const sculptedVertices = Number(await stage.getAttribute("data-m3-premium-nose-vertices"));
    const noseDelta = Number(await stage.getAttribute("data-m3-premium-nose-delta"));
    if (gender === "male") {
      console.log("M3_PREMIUM_MALE_GEOMETRY " + String(await stage.getAttribute("data-m3-premium-nose-probe")));
      expect(sculptedVertices).toBeGreaterThan(15);
      expect(noseDelta).toBeGreaterThan(.002);
      expect(noseDelta).toBeLessThan(.018);
    } else {
      expect(sculptedVertices).toBe(0); // Female accepted geometry is untouched.
    }
    console.log("M3_PREMIUM_FACE " + gender + " " + JSON.stringify({
      sculptedVertices, noseDelta,
      physical: await stage.getAttribute("data-m3-premium-physical-details"),
      bones: await stage.getAttribute("data-m3-bones"),
      bindDelta: await stage.getAttribute("data-m3-bind-delta"),
    }));
    await page.screenshot({
      path: "test-results/m3-premium-cute/creator-" + gender + ".png",
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Mặt · Tuỳ chỉnh khuôn mặt →" }).click();
    await expect(stage).toHaveAttribute("data-focus", "face");
    await page.screenshot({
      path: "test-results/m3-premium-cute/creator-" + gender + "-face-front.png",
      animations: "disabled",
    });
    const viewport = page.getByTestId("c2-character-viewport");
    const initialYaw = Number(await viewport.getAttribute("data-yaw"));
    const rect = await viewport.boundingBox();
    if (!rect) throw new Error("Cannot inspect premium 3/4 face without creator viewport");
    await page.mouse.move(rect.x + rect.width * .74, rect.y + rect.height * .50);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * .48, rect.y + rect.height * .50, { steps: 8 });
    await page.mouse.up();
    await page.screenshot({
      path: "test-results/m3-premium-cute/creator-" + gender + "-face-three-quarter.png",
      animations: "disabled",
    });
    // Restore the exact starting yaw. Otherwise male "face-front" inherits
    // female's three-quarter camera and is mislabeled as a frontal view.
    await page.mouse.move(rect.x + rect.width * .48, rect.y + rect.height * .50);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * .74, rect.y + rect.height * .50, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => Number(await viewport.getAttribute("data-yaw"))).toBeCloseTo(initialYaw, 1);
    await page.getByRole("button", { name: "← Tạo hình" }).click();
    await expect(stage).toHaveAttribute("data-focus", "body");
  }
  expect(errors).toEqual([]);
});

for (const fixture of [
  { query: "female", actors: "1", m3: "1" },
  { query: "male", actors: "1", m3: "1" },
  { query: "five", actors: "5", m3: "3" },
]) {
  test("M3 premium real lobby fixture " + fixture.query, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/tools/lobby-qa-sketch?m3=" + fixture.query);
    const stage = page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 110_000 });
    await expect(stage).toHaveAttribute("data-actor-count", fixture.actors);
    await expect(stage).toHaveAttribute("data-m3-idle-count", fixture.m3);
    await page.waitForTimeout(800);
    await page.screenshot({
      path: "test-results/m3-premium-cute/lobby-" + fixture.query + ".png",
      animations: "disabled",
    });
    const before = await stage.getAttribute("data-scene-generation");
    await page.waitForTimeout(750);
    expect(await stage.getAttribute("data-scene-generation")).toBe(before);
    expect(errors).toEqual([]);
  });
}
