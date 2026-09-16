import { P37_DANCE_CANDIDATES } from "./asset-catalog";

export const P37_DANCE_POOL_ID = "solo-easy-dance-pool" as const;
export const P37_DANCE_POOL_VERSION = 1 as const;
export const P37_DANCE_POOL_SOURCE_VERSION = "mixamo-p3.7-2026-09-15" as const;

export type DanceReviewDecision = "approved" | "rejected";
export type DanceReviewDecisions = Record<string, DanceReviewDecision>;

export type DancePoolRoleAssignment = {
  normal: boolean;
  final: boolean;
};
export type DancePoolRoleAssignments = Record<string, DancePoolRoleAssignment>;

export type DancePoolReviewManifest = {
  schemaVersion: 1;
  poolId: typeof P37_DANCE_POOL_ID;
  poolVersion: typeof P37_DANCE_POOL_VERSION;
  status: "draft";
  sourceVersion: typeof P37_DANCE_POOL_SOURCE_VERSION;
  runtimeProcessingIds: string[];
  approvedIds: string[];
  normalIds: string[];
  finalIds: string[];
  rejectedIds: string[];
  unreviewedIds: string[];
  candidateCount: number;
  runtimeReady: false;
  note: string;
};

// Runtime processing is intentionally decoupled from owner approval. We can
// normalize/bake every acquired candidate once, while the owner can keep
// changing Approve/Reject decisions and Normal/Final role membership without
// rebuilding the content pipeline.
export const P37_RUNTIME_PROCESSING_IDS = P37_DANCE_CANDIDATES.map(asset => asset.id) as readonly string[];

export const P37_DANCE_POOL_DRAFT = createP37DancePoolReviewManifest({}, {});

export function normalizeDancePoolRoles(
  decisions: DanceReviewDecisions,
  roles: DancePoolRoleAssignments,
): DancePoolRoleAssignments {
  const normalized: DancePoolRoleAssignments = {};
  for (const asset of P37_DANCE_CANDIDATES) {
    if (decisions[asset.id] !== "approved") continue;
    const current = roles[asset.id];
    normalized[asset.id] = current
      ? { normal: Boolean(current.normal), final: Boolean(current.final) }
      : { normal: true, final: false };
  }
  return normalized;
}

export function createP37DancePoolReviewManifest(
  decisions: DanceReviewDecisions,
  roles: DancePoolRoleAssignments = {},
): DancePoolReviewManifest {
  const candidateIds = P37_DANCE_CANDIDATES.map(asset => asset.id);
  const normalizedRoles = normalizeDancePoolRoles(decisions, roles);
  const approvedIds: string[] = [];
  const normalIds: string[] = [];
  const finalIds: string[] = [];
  const rejectedIds: string[] = [];
  const unreviewedIds: string[] = [];

  for (const id of candidateIds) {
    const decision = decisions[id];
    if (decision === "approved") {
      approvedIds.push(id);
      if (normalizedRoles[id]?.normal) normalIds.push(id);
      if (normalizedRoles[id]?.final) finalIds.push(id);
    } else if (decision === "rejected") rejectedIds.push(id);
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
    normalIds,
    finalIds,
    rejectedIds,
    unreviewedIds,
    candidateCount: candidateIds.length,
    runtimeReady: false,
    note: "Owner review and Normal/Final role assignment are mutable. Gameplay consumes only immutable published releases, never browser-local decisions.",
  };
}
