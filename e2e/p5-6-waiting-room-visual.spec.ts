import { expect, test } from "@playwright/test";

test("P5.6 waiting room uses host-first Character Catalog lineup", async ({ page }) => {
  await page.goto("/tools/lobby-qa");

  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-view", "wide");
  await expect(stage).toHaveAttribute("data-layout", "host-first");
  await expect(stage).toHaveAttribute(
    "data-character-assets",
    "c4-casual-boy,c1-casual-grace,c4-casual-boy",
  );

  await expect(page.getByTestId("p56-host-identity")).toHaveAttribute(
    "data-character-asset-id",
    "c4-casual-boy",
  );

  const deck = page.getByTestId("p56-participant-deck");
  await expect(deck.locator('[data-character-asset-id="c1-casual-grace"]')).toHaveCount(1);
  await expect(deck.locator('[data-character-asset-id="c4-casual-boy"]')).toHaveCount(1);
});
