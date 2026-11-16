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
    await page.screenshot({
      path: "test-results/m3-premium-cute/creator-" + gender + ".png",
      animations: "disabled",
    });
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
