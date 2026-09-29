import { expect, test } from "@playwright/test";
import {
  DEFAULT_STAGE_ID,
  SELECTABLE_STAGE_IDS,
  STAGE_CATALOG,
  STAGE_CATALOG_IDS,
  STAGE_RUNTIME_ASSET_IDS,
  resolveRuntimeStageCatalogEntry,
  resolveStageCatalogEntry,
  selectableStageCatalogEntries,
} from "../components/stage/stage-catalog";

test("S2 Stage Catalog keeps Bright Stage V1 as the accepted runnable default", () => {
  expect(DEFAULT_STAGE_ID).toBe("bright-stage-v1");
  expect(STAGE_CATALOG[DEFAULT_STAGE_ID]).toEqual({
    id: "bright-stage-v1",
    displayName: "Bright Stage",
    kind: "stage",
    runtimeAssetId: "bright-stage-v1",
    presentationProfileId: "bright-stage-v1",
    selectable: true,
    status: "active",
  });
  expect(SELECTABLE_STAGE_IDS).toEqual(["bright-stage-v1"]);
  expect(selectableStageCatalogEntries().map(entry => entry.id)).toEqual(["bright-stage-v1"]);
});

test("S2 Stage Catalog reserves the S2.5 environment pack without exposing unfinished content", () => {
  expect(STAGE_CATALOG_IDS).toEqual([
    "bright-stage-v1",
    "neon-stage-v1",
    "football-field-v1",
    "classroom-v1",
    "cafe-v1",
    "performance-stage-v1",
    "neon-club-v3",
  ]);

  for (const id of ["neon-stage-v1", "football-field-v1", "classroom-v1", "cafe-v1"] as const) {
    expect(STAGE_CATALOG[id].status).toBe("planned");
    expect(STAGE_CATALOG[id].selectable).toBe(false);
    expect(STAGE_CATALOG[id].runtimeAssetId).toBeNull();
    expect(STAGE_CATALOG[id].presentationProfileId).toBeNull();
  }

  expect(STAGE_CATALOG["neon-stage-v1"].kind).toBe("stage");
  expect(STAGE_CATALOG["football-field-v1"].kind).toBe("sports");
  expect(STAGE_CATALOG["classroom-v1"].kind).toBe("classroom");
  expect(STAGE_CATALOG["cafe-v1"].kind).toBe("cafe");
});

test("S2 Stage Catalog preserves legacy runtime assets without making them selectable", () => {
  expect(STAGE_RUNTIME_ASSET_IDS).toEqual([
    "bright-stage-v1",
    "performance-stage-v1",
    "neon-club-v3",
  ]);
  expect(STAGE_CATALOG["performance-stage-v1"].status).toBe("legacy");
  expect(STAGE_CATALOG["performance-stage-v1"].selectable).toBe(false);
  expect(STAGE_CATALOG["neon-club-v3"].status).toBe("rejected");
  expect(STAGE_CATALOG["neon-club-v3"].selectable).toBe(false);
});

test("S2 Stage Catalog separates requested identity from runnable fallback", () => {
  expect(resolveStageCatalogEntry(undefined).id).toBe("bright-stage-v1");
  expect(resolveStageCatalogEntry(null).id).toBe("bright-stage-v1");
  expect(resolveStageCatalogEntry("unknown-stage").id).toBe("bright-stage-v1");

  expect(resolveStageCatalogEntry("neon-stage-v1").id).toBe("neon-stage-v1");
  expect(resolveRuntimeStageCatalogEntry("neon-stage-v1").id).toBe("bright-stage-v1");

  expect(resolveRuntimeStageCatalogEntry("performance-stage-v1").runtimeAssetId)
    .toBe("performance-stage-v1");
});
