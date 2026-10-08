import { expect, test } from "@playwright/test";
import { NeonStageV1Environment } from "../components/stage/NeonStageV1Environment";
import {
  STAGE_CATALOG,
  resolveRuntimeStageCatalogEntry,
} from "../components/stage/stage-catalog";

test("S2.5A Neon Stage V1 is runnable for direct owner QA but remains hidden from S3 selection", () => {
  const entry = STAGE_CATALOG["neon-stage-v1"];
  expect(entry.status).toBe("planned");
  expect(entry.selectable).toBe(false);
  expect(entry.runtimeAssetId).toBe("neon-stage-v1");
  expect(entry.presentationProfileId).toBe("neon-stage-v1");
  expect(resolveRuntimeStageCatalogEntry("neon-stage-v1").id).toBe("neon-stage-v1");
  expect(typeof NeonStageV1Environment).toBe("function");
});
