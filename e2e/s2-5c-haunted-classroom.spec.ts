import { expect, test } from "@playwright/test";
import { createStageEnvironment } from "../components/stage/stage-runtime";
import { DEFAULT_STAGE_ID, resolveRuntimeStageCatalogEntry, SELECTABLE_STAGE_IDS, STAGE_CATALOG } from "../components/stage/stage-catalog";

test("S2.5C haunted classroom resolves to the real Three.js runtime but cannot yet be host-selected", () => {
  expect(DEFAULT_STAGE_ID).toBe("bright-stage-v1");
  expect(SELECTABLE_STAGE_IDS).not.toContain("classroom-v1");
  const entry = resolveRuntimeStageCatalogEntry("classroom-v1");
  expect(entry.id).toBe("classroom-v1");
  expect(entry.kind).toBe("classroom");
  expect(entry.runtimeAssetId).toBe("classroom-v1");
  expect(entry.presentationProfileId).toBe("classroom-v1");
  expect(STAGE_CATALOG["classroom-v1"].selectable).toBe(false);
  const instance = createStageEnvironment(entry);
  expect(instance.root.name).toBe("HauntedClassroomV1Environment");
  instance.dispose();
});

test("Haunted Classroom Stage3D QA selects zero through five preview actors without multiplayer", async ({ page }) => {
  await page.goto("/tools/haunted-classroom-stage");
  const surface = page.locator('[data-selected-stage-id="classroom-v1"]');
  await expect(surface).toBeVisible();
  await expect(surface).toHaveAttribute("data-preview-actor-count", "1");
  // The camera pose must be identical for every 0–5 formation. This catches
  // the V7 split that widened the shot whenever count reached 4.
  await expect(surface).toHaveAttribute("data-qa-camera-frame", /.+:.+:.+/);
  const initialCamera = await surface.getAttribute("data-qa-camera-frame");
  for (const count of [0, 2, 3, 4, 5, 1]) {
    await page.getByRole("button", {
      name: count === 0 ? "Sân trống" : `${count} nhân vật`,
    }).click();
    await expect(surface).toHaveAttribute("data-preview-actor-count", String(count));
    await expect(surface).toHaveAttribute("data-qa-camera-frame", initialCamera!);
  }
  await expect(surface).toHaveAttribute("data-stage-catalog-id", "classroom-v1");
});
