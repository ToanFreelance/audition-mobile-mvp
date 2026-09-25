import { expect, test } from "@playwright/test";

test("P5.6 waiting room uses a five-slot focus carousel without rebuilding the 3D scene", async ({ page }) => {
  await page.goto("/tools/lobby-qa");

  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-view", "wide");
  await expect(stage).toHaveAttribute("data-layout", "host-first");
  await expect(stage).toHaveAttribute("data-max-players", "5");
  await expect(stage).toHaveAttribute("data-focus-participant-id", "p51-host");
  await expect(stage).toHaveAttribute(
    "data-character-assets",
    "c4-casual-boy,c1-casual-grace,c4-casual-boy",
  );

  await expect(page.getByTestId("room-summary")).toContainText("3/5");
  await expect(page.getByTestId("slot-5")).toHaveCount(0);

  const identity = page.getByTestId("p56-focused-identity");
  await expect(identity).toHaveAttribute("data-character-asset-id", "c4-casual-boy");
  await expect(identity).toContainText("Toan");
  await expect(identity).toContainText("HOST");

  await expect(stage).not.toHaveAttribute("data-scene-generation", "0");
  const generation = await stage.getAttribute("data-scene-generation");
  await page.getByRole("button", { name: "Next participants" }).click();

  await expect(stage).toHaveAttribute("data-focus-participant-id", "p51-guest");
  await expect(identity).toHaveAttribute("data-character-asset-id", "c1-casual-grace");
  await expect(identity).toContainText("LinhCute");
  await expect(identity).toContainText("NOT READY");
  await expect(stage).toHaveAttribute("data-scene-generation", generation ?? "1");

  await page.getByRole("button", { name: "Previous participants" }).click();
  await expect(stage).toHaveAttribute("data-focus-participant-id", "p51-host");
  await expect(identity).toContainText("HOST");

  const deck = page.getByTestId("p56-participant-deck");
  await expect(deck.locator('[data-character-asset-id="c1-casual-grace"]')).toHaveCount(1);
  await expect(deck.locator('[data-character-asset-id="c4-casual-boy"]')).toHaveCount(1);
});
