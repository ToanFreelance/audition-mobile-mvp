"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { P37_DANCE_CANDIDATES } from "./asset-catalog";
import {
  normalizeDancePoolRoles,
  type DancePoolRoleAssignments,
  type DanceReviewDecisions,
} from "./animation-pool";
import { getCachedRuntimeClip, putCachedRuntimeClip } from "./asset-lab-runtime-cache";
import { P37AssetLabRuntimeProcessor } from "./asset-lab-runtime-processor";
import {
  getAssetLabSourceArchive,
  subscribeAssetLabSourceArchive,
} from "./asset-lab-session";
import type { LocalAssetZip } from "./asset-lab-local-package";
import AssetLabPublisher from "./AssetLabPublisher";

type RuntimeStatus = "idle" | "waiting-source" | "processing" | "ready" | "error";
type Props = {
  decisions: DanceReviewDecisions;
  selectedAssetId: string;
};

const ROLE_STORAGE_KEY = "audition:p3.7:asset-lab:pool-roles:v1";

export default function AssetLabAutoProcessor({ decisions, selectedAssetId }: Props) {
  const [archive, setArchive] = useState<LocalAssetZip | null>(() => getAssetLabSourceArchive());
  const [statuses, setStatuses] = useState<Record<string, RuntimeStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [roles, setRoles] = useState<DancePoolRoleAssignments>({});
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const decisionsRef = useRef(decisions);
  const archiveRef = useRef<LocalAssetZip | null>(archive);
  const statusesRef = useRef<Record<string, RuntimeStatus>>({});
  const errorsRef = useRef<Record<string, string>>({});
  const runningRef = useRef(false);
  const processorRef = useRef<P37AssetLabRuntimeProcessor | null>(null);

  const updateStatus = useCallback((assetId: string, status: RuntimeStatus, error?: string) => {
    setStatuses(current => {
      const next = { ...current, [assetId]: status };
      statusesRef.current = next;
      return next;
    });
    setErrors(current => {
      const next = { ...current };
      if (error) next[assetId] = error;
      else delete next[assetId];
      errorsRef.current = next;
      return next;
    });
  }, []);

  const runQueue = useCallback(async () => {
    if (runningRef.current || !cacheLoaded) return;
    const currentArchive = archiveRef.current;

    if (!currentArchive) {
      for (const asset of P37_DANCE_CANDIDATES) {
        if (decisionsRef.current[asset.id] === "approved" && statusesRef.current[asset.id] !== "ready") {
          updateStatus(asset.id, "waiting-source");
        }
      }
      return;
    }

    runningRef.current = true;
    processorRef.current ??= new P37AssetLabRuntimeProcessor();

    try {
      while (true) {
        const asset = P37_DANCE_CANDIDATES.find(candidate => {
          const status = statusesRef.current[candidate.id] ?? "idle";
          return decisionsRef.current[candidate.id] === "approved"
            && status !== "ready"
            && status !== "processing"
            && status !== "error";
        });
        if (!asset) break;

        updateStatus(asset.id, "processing");
        try {
          const record = await processorRef.current.process(currentArchive, asset);
          if (record.sourceSha256 !== asset.sha256) {
            throw new Error("Processed clip source checksum does not match the catalog");
          }
          await putCachedRuntimeClip(record);
          updateStatus(asset.id, "ready");
        } catch (error) {
          updateStatus(asset.id, "error", error instanceof Error ? error.message : "Unknown runtime processing error");
        }
        await nextFrame();
      }
    } finally {
      runningRef.current = false;
    }
  }, [cacheLoaded, updateStatus]);

  useEffect(() => {
    decisionsRef.current = decisions;
    void runQueue();
  }, [decisions, runQueue]);

  useEffect(() => {
    archiveRef.current = archive;
    void runQueue();
  }, [archive, runQueue]);

  useEffect(() => subscribeAssetLabSourceArchive(next => {
    archiveRef.current = next;
    setArchive(next);
  }), []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ROLE_STORAGE_KEY);
      if (raw) setRoles(JSON.parse(raw) as DancePoolRoleAssignments);
    } catch {
      // Role state is owner convenience only; canonical roles live in releases.
    } finally {
      setRolesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!rolesLoaded) return;
    setRoles(current => normalizeDancePoolRoles(decisions, current));
  }, [decisions, rolesLoaded]);

  useEffect(() => {
    if (!rolesLoaded) return;
    try {
      window.localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(roles));
    } catch {
      // Local persistence must never block review/processing.
    }
  }, [roles, rolesLoaded]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(P37_DANCE_CANDIDATES.map(async asset => {
      const cached = await getCachedRuntimeClip(asset.id);
      if (!cached || cached.sourceSha256 !== asset.sha256) return null;
      return asset.id;
    })).then(readyIds => {
      if (cancelled) return;
      const next: Record<string, RuntimeStatus> = {};
      for (const id of readyIds) if (id) next[id] = "ready";
      statusesRef.current = next;
      setStatuses(next);
      setCacheLoaded(true);
    }).catch(error => {
      if (cancelled) return;
      console.warn("[asset-lab] runtime cache restore failed", error);
      setCacheLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    processorRef.current?.dispose();
    processorRef.current = null;
  }, []);

  const approvedIds = useMemo(
    () => P37_DANCE_CANDIDATES.filter(asset => decisions[asset.id] === "approved").map(asset => asset.id),
    [decisions],
  );
  const readyApproved = approvedIds.filter(id => statuses[id] === "ready").length;
  const processingApproved = approvedIds.filter(id => statuses[id] === "processing").length;
  const waitingApproved = approvedIds.filter(id => statuses[id] === "waiting-source" || !statuses[id]).length;
  const errorApproved = approvedIds.filter(id => statuses[id] === "error").length;
  const selectedStatus = statuses[selectedAssetId] ?? "idle";
  const selectedError = errors[selectedAssetId];
  const progress = approvedIds.length > 0 ? readyApproved / approvedIds.length : 0;
  const selectedApproved = decisions[selectedAssetId] === "approved";
  const selectedRoles = roles[selectedAssetId] ?? { normal: selectedApproved, final: false };
  const normalCount = P37_DANCE_CANDIDATES.filter(asset => decisions[asset.id] === "approved" && roles[asset.id]?.normal).length;
  const finalCount = P37_DANCE_CANDIDATES.filter(asset => decisions[asset.id] === "approved" && roles[asset.id]?.final).length;

  const retrySelected = () => {
    updateStatus(selectedAssetId, archiveRef.current ? "idle" : "waiting-source");
    queueMicrotask(() => void runQueue());
  };

  const toggleRole = (role: "normal" | "final") => {
    if (!selectedApproved) return;
    setRoles(current => {
      const existing = current[selectedAssetId] ?? { normal: true, final: false };
      return {
        ...current,
        [selectedAssetId]: { ...existing, [role]: !existing[role] },
      };
    });
  };

  return (
    <>
      <section style={styles.roleCard}>
        <div style={styles.topline}>
          <div>
            <p style={styles.roleKicker}>GAME POOL ROLE</p>
            <strong>Approved asset → Normal / Final</strong>
          </div>
          <span style={styles.roleCounts}>{normalCount} normal · {finalCount} final</span>
        </div>
        <div style={styles.roleButtons}>
          <button
            type="button"
            disabled={!selectedApproved}
            onClick={() => toggleRole("normal")}
            style={roleButtonStyle(selectedRoles.normal, !selectedApproved, "normal")}
          >
            {selectedRoles.normal ? "✓" : "+"} NORMAL
          </button>
          <button
            type="button"
            disabled={!selectedApproved}
            onClick={() => toggleRole("final")}
            style={roleButtonStyle(selectedRoles.final, !selectedApproved, "final")}
          >
            {selectedRoles.final ? "★" : "+"} FINAL
          </button>
        </div>
        <p style={styles.note}>
          {selectedApproved
            ? "Normal and Final are independent. One animation may be in both pools, or only one. Final selection is deterministic from seed + Finish absolute turn at runtime."
            : "Approve this animation first, then assign it to the Normal pool, Final pool, or both."}
        </p>
      </section>

      <section style={styles.card}>
        <div style={styles.topline}>
          <div>
            <p style={styles.kicker}>AUTO PROCESSING</p>
            <strong>Approved → runtime-ready</strong>
          </div>
          <RuntimeBadge status={selectedStatus} />
        </div>

        <div style={styles.stats}>
          <span>{approvedIds.length} approved</span>
          <span>{readyApproved} ready</span>
          {processingApproved > 0 && <span>{processingApproved} processing</span>}
          {waitingApproved > 0 && <span>{waitingApproved} waiting</span>}
          {errorApproved > 0 && <span style={styles.errorText}>{errorApproved} error</span>}
        </div>

        <div style={styles.track} aria-label="approved runtime processing progress">
          <div style={{ ...styles.fill, width: `${Math.round(progress * 100)}%` }} />
        </div>

        <p style={styles.note}>
          {!cacheLoaded
            ? "Checking the browser runtime cache…"
            : !archive && approvedIds.length > readyApproved
              ? "Approved animations are queued. Load the private source ZIP once above; queued items will bake automatically."
              : approvedIds.length === 0
                ? "Approve any dance to process it automatically. Processed clips are cached in IndexedDB so review changes do not require another bake."
                : readyApproved === approvedIds.length
                  ? "All approved animations are runtime-ready in the local processing cache."
                  : "Processing approved animations into Quaternius rotation-only clips…"}
        </p>

        {selectedStatus === "error" && (
          <div style={styles.errorBox}>
            <span>{selectedError ?? "Runtime processing failed"}</span>
            <button type="button" onClick={retrySelected} style={styles.retryButton}>Retry selected</button>
          </div>
        )}

        <div style={styles.publishGate}>
          <strong>Publish gate</strong>
          <span>Only Approved + READY clips assigned to Normal or Final enter the canonical release. Role changes create a new immutable version without rebaking the source.</span>
        </div>
      </section>

      <AssetLabPublisher decisions={decisions} roles={roles} />
    </>
  );
}

function RuntimeBadge({ status }: { status: RuntimeStatus }) {
  const label = status === "waiting-source" ? "WAITING ZIP" : status.toUpperCase();
  return <span style={runtimeBadgeStyle(status)}>{label}</span>;
}

function runtimeBadgeStyle(status: RuntimeStatus): CSSProperties {
  const ready = status === "ready";
  const error = status === "error";
  const processing = status === "processing";
  return {
    borderRadius: 999,
    padding: "6px 8px",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: ".08em",
    color: ready ? "#78e8b5" : error ? "#ff9eaa" : processing ? "#dac8ff" : "#a8b0be",
    background: ready ? "#12372b" : error ? "#42202a" : processing ? "#2a2041" : "#232832",
  };
}

function roleButtonStyle(active: boolean, disabled: boolean, role: "normal" | "final"): CSSProperties {
  const accent = role === "final" ? "#f1b95d" : "#7f9cff";
  const activeBackground = role === "final" ? "#3d2c10" : "#1d294a";
  return {
    flex: 1,
    minHeight: 42,
    border: active ? `1px solid ${accent}` : "1px solid #343b49",
    borderRadius: 11,
    background: active ? activeBackground : "#171a21",
    color: disabled ? "#555d6a" : active ? "#fff4d7" : "#aab2c0",
    fontWeight: 950,
    letterSpacing: ".04em",
    opacity: disabled ? 0.55 : 1,
  };
}

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

const styles: Record<string, CSSProperties> = {
  roleCard: { display: "grid", gap: 10, padding: 12, border: "1px solid #554326", borderRadius: 15, background: "#17130d" },
  roleKicker: { margin: 0, color: "#c9a462", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" },
  roleCounts: { borderRadius: 999, padding: "6px 8px", background: "#2a2419", color: "#d7bd8b", fontSize: 9, fontWeight: 900 },
  roleButtons: { display: "flex", gap: 8 },
  card: { display: "grid", gap: 10, padding: 12, border: "1px solid #2f3441", borderRadius: 15, background: "#11141a" },
  topline: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  kicker: { margin: 0, color: "#8f98aa", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" },
  stats: { display: "flex", flexWrap: "wrap", gap: 6, color: "#939cad", fontSize: 11 },
  track: { height: 7, overflow: "hidden", borderRadius: 999, background: "#222732" },
  fill: { height: "100%", borderRadius: 999, background: "#8f6bd4", transition: "width 160ms linear" },
  note: { margin: 0, color: "#8f98aa", fontSize: 11, lineHeight: 1.45 },
  errorText: { color: "#ff9eaa" },
  errorBox: { display: "grid", gap: 8, padding: 10, borderRadius: 10, background: "#2b171d", color: "#ffb0ba", fontSize: 11 },
  retryButton: { justifySelf: "start", border: "1px solid #71404b", background: "#42202a", color: "#ffe6ea", borderRadius: 9, padding: "7px 10px", fontWeight: 850 },
  publishGate: { display: "grid", gap: 3, padding: 10, borderRadius: 10, background: "#171a21", color: "#7f8999", fontSize: 10, lineHeight: 1.45 },
};
