export const STAGE_CATALOG_IDS = [
  "bright-stage-v1",
  "neon-stage-v1",
  "football-field-v1",
  "classroom-v1",
  "cafe-v1",
  "performance-stage-v1",
  "neon-club-v3",
] as const;

export const STAGE_RUNTIME_ASSET_IDS = [
  "bright-stage-v1",
  "performance-stage-v1",
  "neon-club-v3",
] as const;

export const STAGE_PRESENTATION_PROFILE_IDS = [
  "bright-stage-v1",
  "performance-stage-v1",
  "neon-club-v3",
] as const;

export type StageCatalogId = (typeof STAGE_CATALOG_IDS)[number];
export type StageRuntimeAssetId = (typeof STAGE_RUNTIME_ASSET_IDS)[number];
export type StagePresentationProfileId = (typeof STAGE_PRESENTATION_PROFILE_IDS)[number];
export type StageEnvironmentKind = "stage" | "sports" | "classroom" | "cafe";
export type StageCatalogStatus = "active" | "planned" | "legacy" | "rejected";

export type StageCatalogEntry = Readonly<{
  id: StageCatalogId;
  displayName: string;
  kind: StageEnvironmentKind;
  runtimeAssetId: StageRuntimeAssetId | null;
  presentationProfileId: StagePresentationProfileId | null;
  selectable: boolean;
  status: StageCatalogStatus;
}>;

export type RunnableStageCatalogEntry = StageCatalogEntry & Readonly<{
  runtimeAssetId: StageRuntimeAssetId;
  presentationProfileId: StagePresentationProfileId;
}>;

export const DEFAULT_STAGE_ID: StageCatalogId = "bright-stage-v1";

export const STAGE_CATALOG: Readonly<Record<StageCatalogId, StageCatalogEntry>> = {
  "bright-stage-v1": {
    id: "bright-stage-v1",
    displayName: "Bright Stage",
    kind: "stage",
    runtimeAssetId: "bright-stage-v1",
    presentationProfileId: "bright-stage-v1",
    selectable: true,
    status: "active",
  },
  "neon-stage-v1": {
    id: "neon-stage-v1",
    displayName: "Neon Stage",
    kind: "stage",
    runtimeAssetId: null,
    presentationProfileId: null,
    selectable: false,
    status: "planned",
  },
  "football-field-v1": {
    id: "football-field-v1",
    displayName: "Football Field",
    kind: "sports",
    runtimeAssetId: null,
    presentationProfileId: null,
    selectable: false,
    status: "planned",
  },
  "classroom-v1": {
    id: "classroom-v1",
    displayName: "Classroom",
    kind: "classroom",
    runtimeAssetId: null,
    presentationProfileId: null,
    selectable: false,
    status: "planned",
  },
  "cafe-v1": {
    id: "cafe-v1",
    displayName: "Cafe",
    kind: "cafe",
    runtimeAssetId: null,
    presentationProfileId: null,
    selectable: false,
    status: "planned",
  },
  "performance-stage-v1": {
    id: "performance-stage-v1",
    displayName: "Performance Stage V1",
    kind: "stage",
    runtimeAssetId: "performance-stage-v1",
    presentationProfileId: "performance-stage-v1",
    selectable: false,
    status: "legacy",
  },
  "neon-club-v3": {
    id: "neon-club-v3",
    displayName: "Neon Club V3",
    kind: "stage",
    runtimeAssetId: "neon-club-v3",
    presentationProfileId: "neon-club-v3",
    selectable: false,
    status: "rejected",
  },
};

export const SELECTABLE_STAGE_IDS: readonly StageCatalogId[] =
  STAGE_CATALOG_IDS.filter(id => STAGE_CATALOG[id].selectable);

export function isStageCatalogId(value: unknown): value is StageCatalogId {
  return typeof value === "string" && (STAGE_CATALOG_IDS as readonly string[]).includes(value);
}

export function isStageRuntimeAssetId(value: unknown): value is StageRuntimeAssetId {
  return typeof value === "string" && (STAGE_RUNTIME_ASSET_IDS as readonly string[]).includes(value);
}

export function isRunnableStageCatalogEntry(
  entry: StageCatalogEntry,
): entry is RunnableStageCatalogEntry {
  return entry.runtimeAssetId !== null && entry.presentationProfileId !== null;
}

export function resolveStageCatalogEntry(stageId: string | null | undefined): StageCatalogEntry {
  return isStageCatalogId(stageId)
    ? STAGE_CATALOG[stageId]
    : STAGE_CATALOG[DEFAULT_STAGE_ID];
}

export function resolveRuntimeStageCatalogEntry(
  stageId: string | null | undefined,
): RunnableStageCatalogEntry {
  const requested = resolveStageCatalogEntry(stageId);
  if (isRunnableStageCatalogEntry(requested)) return requested;

  const fallback = STAGE_CATALOG[DEFAULT_STAGE_ID];
  if (!isRunnableStageCatalogEntry(fallback)) {
    throw new Error("Stage Catalog default must always resolve to a runnable environment.");
  }
  return fallback;
}

export function selectableStageCatalogEntries(): readonly StageCatalogEntry[] {
  return SELECTABLE_STAGE_IDS.map(id => STAGE_CATALOG[id]);
}
