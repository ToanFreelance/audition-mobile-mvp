import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createStageEnvironment } from "../components/stage/stage-runtime";
import { DEFAULT_STAGE_ID, resolveRuntimeStageCatalogEntry, SELECTABLE_STAGE_IDS, STAGE_CATALOG } from "../components/stage/stage-catalog";

test("S2.5C accepted Haunted Classroom V12 is selectable and resolves to real Three.js runtime", () => {
  expect(DEFAULT_STAGE_ID).toBe("bright-stage-v1");
  expect(SELECTABLE_STAGE_IDS).toContain("classroom-v1");
  const entry = resolveRuntimeStageCatalogEntry("classroom-v1");
  expect(entry.id).toBe("classroom-v1");
  expect(entry.kind).toBe("classroom");
  expect(entry.runtimeAssetId).toBe("classroom-v1");
  expect(entry.presentationProfileId).toBe("classroom-v1");
  expect(STAGE_CATALOG["classroom-v1"].selectable).toBe(true);
  const instance = createStageEnvironment(entry);
  expect(instance.root.name).toBe("HauntedClassroomV1Environment");
  instance.dispose();
  // Host selection is stored as the canonical stage ID. The Stage Catalog
  // must keep exactly that ID for the gameplay runtime (no label fallback).
  expect(SELECTABLE_STAGE_IDS).toEqual([
    "bright-stage-v1", "neon-stage-v1", "basketball-court-v1", "classroom-v1",
  ]);
});

test("Host stage picker presents classroom and retains the existing CAS stage mutation flow", () => {
  const ui = readFileSync(join(process.cwd(), "components/multiplayer/WaitingRoomPanel.tsx"), "utf8");
  expect(ui).toContain('id: "classroom-v1"');
  expect(ui).toContain('name: "Haunted Classroom"');
  expect(ui).toContain('data-testid={`stage-option-${stage.id}`}');
  expect(ui).toContain('action: "stage"');
  expect(ui).toContain("stageId: stageDraft");
  expect(ui).toContain("changeStage(current, current.hostParticipantId, stageDraft)");
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
