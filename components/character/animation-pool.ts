import { P37_DANCE_CANDIDATES } from "./asset-catalog";

export const P37_DANCE_POOL_ID = "solo-easy-dance-pool" as const;
export const P37_DANCE_POOL_VERSION = 1 as const;
export const P37_DANCE_POOL_SOURCE_VERSION = "mixamo-p3.7-2026-09-15" as const;

export type DanceReviewDecision = "approved" | "rejected";
export type DanceReviewDecisions = Record<string, DanceReviewDecision>;

export type DancePoolReviewManifest = {
  schemaVersion: 1;
  poolId: typeof P37_DANCE_POOL_ID;
  poolVersion: typeof P37_DANCE_POOL_VERSION;
  status: "draft";
  sourceVersion: typeof P37_DANCE_POOL_SOURCE_VERSION;
  runtimeProcessingIds: string[];
  approvedIds: string[];
  rejectedIds: string[];
  unreviewedIds: string[];
  candidateCount: number;
  runtimeReady: false;
  note: string;
};

// Runtime processing is intentionally decoupled from owner approval. We can
// normalize/bake every acquired candidate once, while the owner can keep
// changing Approve/Reject decisions without rebuilding the content pipeline.
export const P37_RUNTIME_PROCESSING_IDS = P37_DANCE_CANDIDATES.map(asset => asset.id) as readonly string[];

export const P37_DANCE_POOL_DRAFT = createP37DancePoolReviewManifest({});

export function createP37DancePoolReviewManifest(
  decisions: DanceReviewDecisions,
): DancePoolReviewManifest {
  const candidateIds = P37_DANCE_CANDIDATES.map(asset => asset.id);
  const approvedIds: string[] = [];
  const rejectedIds: string[] = [];
  const unreviewedIds: string[] = [];

  for (const id of candidateIds) {
    const decision = decisions[id];
    if (decision === "approved") approvedIds.push(id);
    else if (decision === "rejected") rejectedIds.push(id);
    else unreviewedIds.push(id);
  }

  return {
    schemaVersion: 1,
    poolId: P37_DANCE_POOL_ID,
    poolVersion: P37_DANCE_POOL_VERSION,
    status: "draft",
    sourceVersion: P37_DANCE_POOL_SOURCE_VERSION,
    runtimeProcessingIds: [...candidateIds],
    approvedIds,
    rejectedIds,
    unreviewedIds,
    candidateCount: candidateIds.length,
    runtimeReady: false,
    note: "Owner review is mutable. Gameplay must not consume browser-local decisions; a reviewed manifest is promoted separately before runtime integration.",
  };
}
