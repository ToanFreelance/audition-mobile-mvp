export const STAGE_CATALOG_IDS = [
  "bright-stage-v1",
  "performance-stage-v1",
  "neon-club-v3",
] as const;

export type StageCatalogId = (typeof STAGE_CATALOG_IDS)[number];
export type StageRuntimeAssetId = StageCatalogId;
export type StagePresentationProfileId = StageCatalogId;
export type StageCatalogStatus = "active" | "legacy" | "rejected";

export type StageCatalogEntry = Readonly<{
  id: StageCatalogId;
  displayName: string;
  runtimeAssetId: StageRuntimeAssetId;
  presentationProfileId: StagePresentationProfileId;
  selectable: boolean;
  status: StageCatalogStatus;
}>;

export const DEFAULT_STAGE_ID: StageCatalogId = "bright-stage-v1";

export const STAGE_CATALOG: Readonly<Record<StageCatalogId, StageCatalogEntry>> = {
  "bright-stage-v1": {
    id: "bright-stage-v1",
    displayName: "Bright Stage",
    runtimeAssetId: "bright-stage-v1",
    presentationProfileId: "bright-stage-v1",
    selectable: true,
    status: "active",
  },
  "performance-stage-v1": {
    id: "performance-stage-v1",
    displayName: "Performance Stage V1",
    runtimeAssetId: "performance-stage-v1",
    presentationProfileId: "performance-stage-v1",
    selectable: false,
    status: "legacy",
  },
  "neon-club-v3": {
    id: "neon-club-v3",
    displayName: "Neon Club V3",
    runtimeAssetId: "neon-club-v3",
    presentationProfileId: "neon-club-v3",
    selectable: false,
    status: "rejected",
  },
};

export const STAGE_RUNTIME_ASSET_IDS: readonly StageRuntimeAssetId[] =
  STAGE_CATALOG_IDS.map(id => STAGE_CATALOG[id].runtimeAssetId);

export const SELECTABLE_STAGE_IDS: readonly StageCatalogId[] =
  STAGE_CATALOG_IDS.filter(id => STAGE_CATALOG[id].selectable);

export function isStageCatalogId(value: unknown): value is StageCatalogId {
  return typeof value === "string" && (STAGE_CATALOG_IDS as readonly string[]).includes(value);
}

export function isStageRuntimeAssetId(value: unknown): value is StageRuntimeAssetId {
  return typeof value === "string" && (STAGE_RUNTIME_ASSET_IDS as readonly string[]).includes(value);
}

export function resolveStageCatalogEntry(stageId: string | null | undefined): StageCatalogEntry {
  return isStageCatalogId(stageId)
    ? STAGE_CATALOG[stageId]
    : STAGE_CATALOG[DEFAULT_STAGE_ID];
}

export function selectableStageCatalogEntries(): readonly StageCatalogEntry[] {
  return SELECTABLE_STAGE_IDS.map(id => STAGE_CATALOG[id]);
}
