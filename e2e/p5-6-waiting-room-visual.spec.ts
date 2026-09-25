import { expect, test } from "@playwright/test";

test("P5.6 waiting room matches the accepted five-person focus presentation", async ({ page }) => {
  await page.goto("/tools/lobby-qa");

  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-view", "wide");
  await expect(stage).toHaveAttribute("data-layout", "host-first");
  await expect(stage).toHaveAttribute("data-max-players", "5");
  await expect(stage).toHaveAttribute("data-layout-transition", "smooth");
  await expect(stage).toHaveAttribute("data-label-layout", "head-follow");
  await expect(stage).toHaveAttribute("data-focus-participant-id", "p51-host");
  await expect(stage).toHaveAttribute(
    "data-character-assets",
    "c4-casual-boy,c1-casual-grace,c4-casual-boy,c1-casual-grace,c4-casual-boy",
  );

  await expect(page.getByTestId("room-summary")).toContainText("5/5");
  await expect(page.getByTestId("slot-5")).toHaveCount(0);
  await expect(page.locator('[data-testid^="slot-avatar-image-"]')).toHaveCount(5);
  await expect(page.getByTestId("slot-avatar-image-0")).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );
  await expect(page.getByTestId("slot-avatar-image-1")).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );

  const deck = page.getByTestId("p56-participant-deck");
  await expect(deck.locator("button")).toHaveCount(5);
  await expect(deck.getByText("LinhCute")).toBeVisible();
  await expect(deck.getByText("ShuMar")).toBeVisible();
  await expect(deck.getByText("Minh")).toBeVisible();
  await expect(deck.getByText("Mai")).toBeVisible();

  const identity = page.getByTestId("p56-focused-identity");
  await expect(identity).toHaveAttribute("data-character-asset-id", "c4-casual-boy");
  await expect(identity).toContainText("Toan");
  await expect(identity).not.toContainText("HOST");
  await expect(identity.locator("span")).toContainText("♛");

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
  await expect(identity).not.toContainText("HOST");

  await expect(deck.locator('[data-character-asset-id="c1-casual-grace"]')).toHaveCount(2);
  await expect(deck.locator('[data-character-asset-id="c4-casual-boy"]')).toHaveCount(3);

  await expect(page.getByTestId("camera-preset-controls")).toHaveCount(0);
  await page.getByTestId("room-settings-button").click();
  const cameraPresets = page.getByTestId("camera-preset-controls");
  await expect(cameraPresets).toBeVisible();
  await expect(cameraPresets.getByRole("button", { name: "Wide view" })).toHaveAttribute("aria-pressed", "true");
  await cameraPresets.getByRole("button", { name: "Center view" }).click();
  await expect(stage).toHaveAttribute("data-view", "center");
});
