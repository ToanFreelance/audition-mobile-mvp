import { expect, test } from "@playwright/test";

test("S2.5A Neon Stage V1 can be forced for owner review without enabling S3 selection", async ({ page }) => {
  await page.goto("/?stage=neon-stage-v1");
  const stage = page.locator(".stage-3d");
  await expect(stage).toHaveAttribute("data-selected-stage-id", "neon-stage-v1");
  await expect(stage).toHaveAttribute("data-stage-catalog-id", "neon-stage-v1");
  await expect(stage).toHaveAttribute("data-stage-runtime-catalog-id", "neon-stage-v1");
  await expect(stage).toHaveAttribute("data-stage-runtime-asset-id", "neon-stage-v1");
  await expect(stage).toHaveAttribute("data-stage-presentation-profile", "neon-stage-v1");
  await expect(stage).toHaveAttribute("data-stage-catalog-status", "planned");
  await expect(stage).toHaveAttribute("data-stage-selectable", "false");
  await expect(stage).toHaveAttribute("data-stage-runtime-fallback", "false");
  await expect(stage).toHaveAttribute("data-stage-source", /placeholder|neon-stage-v1/);
});
