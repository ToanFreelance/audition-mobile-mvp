import { expect, test } from "@playwright/test";

test("P5.6 waiting room matches the accepted five-person focus presentation", async ({ page }) => {
  await page.goto("/tools/lobby-qa");

  await expect(page.locator('[data-presentation="full-stage-glass"]')).toHaveCount(1);

  const stage = page.getByTestId("waiting-room-stage");
  await expect(page.getByTestId("waiting-room-stage-loading")).toHaveCount(1);
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 30_000 });
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

  await expect(stage).toHaveAttribute("data-focus-participant-id", "p56-minh");
  await expect(identity).toHaveAttribute("data-character-asset-id", "c4-casual-boy");
  await expect(identity).toContainText("Minh");
  await expect(identity).toContainText("READY");
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
  await expect(stage).toHaveAttribute("data-label-layout", "head-follow");
  await expect(page.getByTestId("p56-focused-identity")).toContainText("Toan");
  await expect(page.getByTestId("p56-focused-identity")).toContainText("Lv. 25");
  await expect(page.getByTestId("p56-focused-identity")).not.toContainText("HOST");

  await cameraPresets.getByRole("button", { name: "Close view" }).click();
  await expect(stage).toHaveAttribute("data-view", "close");
  await expect(stage).toHaveAttribute("data-label-layout", "head-follow");
  const closeIdentity = page.getByTestId("p56-focused-identity");
  await expect(closeIdentity).toContainText("Toan");
  await expect(closeIdentity).toContainText("Lv. 25");
  await expect(closeIdentity).toBeVisible();
});


test("P5.6 QA layout calibrator exposes direct manipulation export without normal carousel arrows", async ({ page }) => {
  await page.goto("/tools/lobby-qa?calibrate=1");

  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-calibration", "1");
  await expect(page.getByTestId("layout-calibration-toolbar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous participants" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next participants" })).toHaveCount(0);

  await page.getByTestId("layout-calibration-export").click();
  const exported = page.getByTestId("layout-calibration-json");
  await expect(exported).toBeVisible();
  await expect(exported).toContainText('"mode": "waiting-room-wide-calibration"');
  await expect(exported).toContainText('"displayName": "Toan"');
  await expect(exported).toContainText('"displayName": "LinhCute"');
});


test("P5.6 accepted owner calibration stays locked", async ({ page }) => {
  await page.goto("/tools/lobby-qa?calibrate=1");
  await page.getByTestId("layout-calibration-export").click();
  const exported = page.getByTestId("layout-calibration-json");
  await expect(exported).toContainText('"x": -0.0764');
  await expect(exported).toContainText('"z": 2.6');
  await expect(exported).toContainText('"x": -1.7004');
  await expect(exported).toContainText('"z": 1.9872');
  await expect(exported).toContainText('"x": 3.0732');
});


test("P5.6 sketch compare route is isolated and uses glossy sketch presentation", async ({ page }) => {
  await page.goto("/tools/lobby-qa-sketch");

  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-visual-preset", "sketch");
  await expect(stage).toHaveAttribute("data-floor-style", "reflective-tile");
  await expect(stage).toHaveAttribute("data-ring-style", "compressed-neon");
  await expect(stage).toHaveAttribute("data-sketch-match", "v12");
  await expect(stage).toHaveAttribute("data-ceiling-source", "threejs");
  await expect(stage).toHaveAttribute("data-backdrop-geometry", "inward-curves");
  await expect(stage).toHaveAttribute("data-ring-palette", "catalog-gender");
  await expect(stage).toHaveAttribute("data-ring-geometry", "two-bold-one-thin");
  await expect(stage).toHaveAttribute("data-ring-reflection", "excluded");
  await expect(stage).toHaveAttribute("data-stage-lighting", "grand");
  await expect(stage).toHaveAttribute("data-character-grade", "warm-neon");
  await expect(stage).toHaveAttribute("data-stage-footprint", "expanded");
  await expect(page.getByTestId("waiting-room-avatar-strip")).toHaveAttribute(
    "data-visual-order",
    "stage-left-to-right",
  );
  await expect(page.locator('[data-visual-preset="sketch"]')).toHaveCount(1);
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 30_000 });

  await page.goto("/tools/lobby-qa");
  await expect(page.getByTestId("waiting-room-stage")).toHaveAttribute("data-visual-preset", "default");
});


test("P5.6 sketch compare keeps focus and avatar selection on the same participant", async ({ page }) => {
  await page.goto("/tools/lobby-qa-sketch");

  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 30_000 });

  await expect(page.getByTestId("slot-0")).toHaveAttribute("data-selected", "1");

  await page.getByRole("button", { name: "Next participants" }).click();
  await expect(stage).toHaveAttribute("data-focus-participant-id", "p56-minh");
  await expect(page.getByTestId("slot-4")).toHaveAttribute("data-selected", "1");

  await page.getByRole("button", { name: "Previous participants" }).click();
  await expect(stage).toHaveAttribute("data-focus-participant-id", "p51-host");
  await expect(page.getByTestId("slot-0")).toHaveAttribute("data-selected", "1");
});
