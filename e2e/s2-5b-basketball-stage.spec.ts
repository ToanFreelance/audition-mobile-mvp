import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BasketballCourtV1Environment } from "../components/stage/BasketballCourtV1Environment";
import { createStageEnvironment } from "../components/stage/stage-runtime";
import {
  DEFAULT_STAGE_ID, SELECTABLE_STAGE_IDS, resolveRuntimeStageCatalogEntry,
} from "../components/stage/stage-catalog";

test("S2.5B exposes exactly Bright, Neon and accepted Basketball Court", () => {
  expect(DEFAULT_STAGE_ID).toBe("bright-stage-v1");
  expect(SELECTABLE_STAGE_IDS).toEqual([
    "bright-stage-v1", "neon-stage-v1", "basketball-court-v1",
  ]);
  const entry = resolveRuntimeStageCatalogEntry("basketball-court-v1");
  expect(entry.runtimeAssetId).toBe("basketball-court-v1");
  expect(entry.presentationProfileId).toBe("basketball-court-v1");
  expect(entry.selectable).toBe(true);
  expect(entry.kind).toBe("sports");
  const runtime = createStageEnvironment(entry);
  expect(runtime.root.name).toBe("BasketballCourtV1Environment");
  runtime.dispose();
});

test("Host stage picker binds the canonical basketball ID and retains legacy room labels", () => {
  const src = readFileSync(join(process.cwd(), "components/multiplayer/WaitingRoomPanel.tsx"), "utf8");
  expect(src).toContain('id: "basketball-court-v1"');
  expect(src).toContain('id: "bright-stage-v1"');
  expect(src).toContain('id: "neon-stage-v1"');
  expect(src).toContain("LEGACY_STAGES");
  expect(src).toContain('action: "stage"');
  expect(src).toContain('stageId: stageDraft');
});
