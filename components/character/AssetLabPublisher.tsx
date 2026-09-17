"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { P37_DANCE_CANDIDATES } from "./asset-catalog";
import {
  P37_DANCE_POOL_ID,
  P37_DANCE_POOL_SOURCE_VERSION,
  P37_DANCE_POOL_VERSION,
  normalizeDancePoolRoles,
  type DancePoolRoleAssignments,
  type DanceReviewDecisions,
} from "./animation-pool";
import { listCachedRuntimeClips } from "./asset-lab-runtime-cache";
import type { RuntimeAnimationBundleClipJson } from "./runtime-animation-bundle";
import IdleAssetLabSection from "./IdleAssetLabSection";

const PUBLISH_ENDPOINT = "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-animation-publish";
const IDLE_PUBLISH_ENDPOINT = "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-animation-publish-idle";
const KEY_STORAGE = "audition:p3.7:asset-lab:publish-key:session";
const PUBLISH_TIMEOUT_MS = 60_000;

type Props = {
  decisions: DanceReviewDecisions;
  roles: DancePoolRoleAssignments;
};

type PublishState = "idle" | "checking" | "publishing" | "published" | "no-changes" | "error";
type LatestRelease = {
  releaseVersion: number;
  clipCount: number;
  normalCount: number;
  finalCount: number;
  idleCount: number;
  publishedAt?: string;
};

type LatestBundle = LatestRelease & {
  normalIds: string[];
  finalIds: string[];
  idleIds: string[];
  clips: RuntimeAnimationBundleClipJson[];
};

type PublishPayload = {
  error?: string;
  noChanges?: boolean;
  release?: {
    releaseVersion?: number;
    clipCount?: number;
    normalIds?: string[];
    finalIds?: string[];
    idleIds?: string[];
    publishedAt?: string;
  };
};

export default function AssetLabPublisher({ decisions, roles }: Props) {
  const [publishKey, setPublishKey] = useState("");
  const [state, setState] = useState<PublishState>("idle");
  const [status, setStatus] = useState("Approved + READY role-assigned clips can be published as an immutable game-content release.");
  const [latest, setLatest] = useState<LatestRelease | null>(null);
  const [latestBundle, setLatestBundle] = useState<LatestBundle | null>(null);
  const [idleIds, setIdleIds] = useState<string[]>([]);

  const normalizedRoles = useMemo(() => normalizeDancePoolRoles(decisions, roles), [decisions, roles]);
  const normalIds = useMemo(
    () => P37_DANCE_CANDIDATES.filter(asset => decisions[asset.id] === "approved" && normalizedRoles[asset.id]?.normal).map(asset => asset.id),
    [decisions, normalizedRoles],
  );
  const finalIds = useMemo(
    () => P37_DANCE_CANDIDATES.filter(asset => decisions[asset.id] === "approved" && normalizedRoles[asset.id]?.final).map(asset => asset.id),
    [decisions, normalizedRoles],
  );

  // An idle-only editing session must never erase the canonical gameplay dance
  // roles just because this browser has no local P3.7 review state. If the owner
  // has made any local Normal/Final selection, that selection remains authoritative;
  // otherwise preserve the latest immutable published dance roles.
  const hasLocalDanceSelection = normalIds.length > 0 || finalIds.length > 0;
  const resolvedNormalIds = useMemo(
    () => hasLocalDanceSelection ? normalIds : latestBundle?.normalIds ?? [],
    [hasLocalDanceSelection, normalIds, latestBundle],
  );
  const resolvedFinalIds = useMemo(
    () => hasLocalDanceSelection ? finalIds : latestBundle?.finalIds ?? [],
    [hasLocalDanceSelection, finalIds, latestBundle],
  );
  const publishIds = useMemo(
    () => [...new Set([...resolvedNormalIds, ...resolvedFinalIds, ...idleIds])],
    [resolvedNormalIds, resolvedFinalIds, idleIds],
  );
  const preservingPublishedDance = !hasLocalDanceSelection && Boolean(latestBundle?.normalIds.length);

  useEffect(() => {
    try {
      setPublishKey(window.sessionStorage.getItem(KEY_STORAGE) ?? "");
    } catch {
      // Owner publish key is convenience-only and never required for rendering.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(PUBLISH_ENDPOINT, { method: "GET", cache: "no-store" })
      .then(async response => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Latest release check failed (${response.status})`);
        const bundle = await response.json() as Record<string, unknown>;
        const processingIds = Array.isArray(bundle.processingIds) ? bundle.processingIds.filter((id): id is string => typeof id === "string") : [];
        const latestNormal = Array.isArray(bundle.normalIds) ? bundle.normalIds.filter((id): id is string => typeof id === "string") : processingIds;
        const latestFinal = Array.isArray(bundle.finalIds) ? bundle.finalIds.filter((id): id is string => typeof id === "string") : [];
        const latestIdle = Array.isArray(bundle.idleIds) ? bundle.idleIds.filter((id): id is string => typeof id === "string") : [];
        const clips = Array.isArray(bundle.clips)
          ? bundle.clips.filter((record): record is RuntimeAnimationBundleClipJson => {
              if (!record || typeof record !== "object") return false;
              const value = record as Record<string, unknown>;
              return typeof value.assetId === "string" && typeof value.runtimeClipName === "string";
            })
          : [];
        return {
          releaseVersion: Number(bundle.releaseVersion ?? 0),
          clipCount: Number(bundle.clipCount ?? processingIds.length),
          normalCount: latestNormal.length,
          finalCount: latestFinal.length,
          idleCount: latestIdle.length,
          publishedAt: typeof bundle.publishedAt === "string" ? bundle.publishedAt : undefined,
          normalIds: latestNormal,
          finalIds: latestFinal,
          idleIds: latestIdle,
          clips,
        } satisfies LatestBundle;
      })
      .then(value => {
        if (cancelled) return;
        setLatestBundle(value);
        setLatest(value ? {
          releaseVersion: value.releaseVersion,
          clipCount: value.clipCount,
          normalCount: value.normalCount,
          finalCount: value.finalCount,
          idleCount: value.idleCount,
          publishedAt: value.publishedAt,
        } : null);
      })
      .catch(error => { if (!cancelled) console.warn("[asset-lab] latest release check failed", error); });
    return () => { cancelled = true; };
  }, [state === "published"]);

  const updateKey = (value: string) => {
    setPublishKey(value);
    try {
      if (value) window.sessionStorage.setItem(KEY_STORAGE, value);
      else window.sessionStorage.removeItem(KEY_STORAGE);
    } catch {
      // Session persistence is optional.
    }
  };

  const publish = async () => {
    if (!resolvedNormalIds.length) {
      setState("error");
      setStatus("No NORMAL dance pool is available. Load the latest published release or assign at least one approved animation to NORMAL before publishing.");
      return;
    }
    if (!publishKey.trim()) {
      setState("error");
      setStatus("Enter the owner publish key first.");
      return;
    }
    if (preservingPublishedDance && !idleIds.length) {
      setState("error");
      setStatus("Select at least one runtime-ready Idle animation before publishing an idle-only update.");
      return;
    }

    setState("checking");

    try {
      let endpoint = PUBLISH_ENDPOINT;
      let body: Record<string, unknown>;
      let publishedClipCount = publishIds.length;

      if (preservingPublishedDance) {
        // Critical mobile path: upload only the new Idle clips. The Edge Function
        // merges them with the canonical Normal/Final bundle server-side. This
        // avoids round-tripping the existing ~9 MB dance bundle through Safari.
        setStatus(`Checking ${idleIds.length} Idle clip(s) in the local runtime cache…`);
        const cachedIdle = await listCachedRuntimeClips(idleIds);
        const missingIdle = idleIds.filter(id => !cachedIdle.has(id));
        if (missingIdle.length) throw new Error(`${missingIdle.length} selected Idle animation(s) are not runtime READY yet`);
        const idleClips = idleIds.map(id => cachedIdle.get(id)!);
        endpoint = IDLE_PUBLISH_ENDPOINT;
        publishedClipCount = resolvedNormalIds.length + resolvedFinalIds.filter(id => !resolvedNormalIds.includes(id)).length + idleIds.length;
        body = {
          schemaVersion: 1,
          kind: "audition-idle-animation-publish-request",
          poolId: P37_DANCE_POOL_ID,
          poolVersion: P37_DANCE_POOL_VERSION,
          sourceVersion: P37_DANCE_POOL_SOURCE_VERSION,
          idleIds,
          clips: idleClips,
        };
        setState("publishing");
        setStatus(`Uploading ${idleIds.length} Idle clip(s); server is preserving ${resolvedNormalIds.length} Normal + ${resolvedFinalIds.length} Final dance roles…`);
      } else {
        setStatus(`Checking ${publishIds.length} unique Normal/Final/Idle clip(s)…`);
        const cached = await listCachedRuntimeClips(publishIds);
        const publishedClipById = new Map(
          (latestBundle?.clips ?? []).map(record => [record.assetId, record] as const),
        );
        const missing = publishIds.filter(id => !cached.has(id) && !publishedClipById.has(id));
        if (missing.length) throw new Error(`${missing.length} selected animation(s) are not runtime READY and are not present in the latest release`);
        const clips = publishIds.map(id => cached.get(id) ?? publishedClipById.get(id)!);
        body = {
          schemaVersion: 1,
          kind: "audition-animation-publish-request",
          poolId: P37_DANCE_POOL_ID,
          poolVersion: P37_DANCE_POOL_VERSION,
          sourceVersion: P37_DANCE_POOL_SOURCE_VERSION,
          approvedIds: [...new Set([...resolvedNormalIds, ...resolvedFinalIds])],
          normalIds: resolvedNormalIds,
          finalIds: resolvedFinalIds,
          idleIds,
          clips,
        };
        publishedClipCount = clips.length;
        setState("publishing");
        setStatus("Checking canonical Normal/Final/Idle content and publishing only if it changed…");
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Asset-Lab-Publish-Key": publishKey.trim(),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("Publish timed out after 60 seconds. Nothing was confirmed; retry once after checking the latest release.");
        }
        throw error;
      } finally {
        window.clearTimeout(timeout);
      }

      const payload = await response.json() as PublishPayload;
      if (!response.ok) throw new Error(payload.error ?? `Publish failed (${response.status})`);

      const releaseVersion = Number(payload.release?.releaseVersion ?? 0);
      const releasedNormalIds = payload.release?.normalIds ?? resolvedNormalIds;
      const releasedFinalIds = payload.release?.finalIds ?? resolvedFinalIds;
      const releasedIdleIds = payload.release?.idleIds ?? idleIds;
      const releaseClipCount = Number(payload.release?.clipCount ?? publishedClipCount);
      setLatest({
        releaseVersion,
        clipCount: releaseClipCount,
        normalCount: releasedNormalIds.length,
        finalCount: releasedFinalIds.length,
        idleCount: releasedIdleIds.length,
        publishedAt: payload.release?.publishedAt,
      });

      if (payload.noChanges) {
        setState("no-changes");
        setStatus(`No changes · release v${releaseVersion} already contains this Normal/Final/Idle runtime content.`);
        return;
      }

      setState("published");
      setStatus(`Published release v${releaseVersion} · ${releasedNormalIds.length} normal · ${releasedFinalIds.length} final · ${releasedIdleIds.length} idle · ${releaseClipCount} unique clip(s).`);
    } catch (error) {
      setState("error");
      setStatus(error instanceof Error ? error.message : "Unknown publish error");
    }
  };

  return (
    <>
      <IdleAssetLabSection onReadyIdleIdsChange={setIdleIds} />

      <section style={styles.card}>
        <div style={styles.topline}>
          <div>
            <p style={styles.kicker}>PUBLISH</p>
            <strong>Normal + Final + Idle pools → canonical release</strong>
          </div>
          <span style={badgeStyle(state)}>{state === "published" ? "PUBLISHED" : state === "no-changes" ? "NO CHANGES" : state.toUpperCase()}</span>
        </div>

        {latest && latest.releaseVersion > 0 && (
          <div style={styles.latestBox}>
            <strong>Latest: release v{latest.releaseVersion}</strong>
            <span>{latest.normalCount} normal · {latest.finalCount} final · {latest.idleCount} idle · {latest.clipCount} unique runtime clip(s){latest.publishedAt ? ` · ${new Date(latest.publishedAt).toLocaleString()}` : ""}</span>
          </div>
        )}

        <div style={styles.selectionBox}>
          <span><b>NORMAL</b> {resolvedNormalIds.length}{preservingPublishedDance ? " preserved" : ""}</span>
          <span><b>FINAL</b> {resolvedFinalIds.length}{preservingPublishedDance ? " preserved" : ""}</span>
          <span><b>IDLE</b> {idleIds.length}</span>
          <span><b>UNIQUE</b> {publishIds.length}</span>
        </div>

        <div style={styles.keyRow}>
          <input type="password" autoComplete="off" value={publishKey} onChange={event => updateKey(event.target.value)} placeholder="Owner publish key" style={styles.keyInput} aria-label="Owner publish key" />
          <button type="button" onClick={() => void publish()} disabled={state === "checking" || state === "publishing"} style={styles.publishButton}>
            {state === "publishing" ? "Publishing…" : `Publish ${resolvedNormalIds.length}N · ${resolvedFinalIds.length}F · ${idleIds.length}I`}
          </button>
        </div>

        <p style={state === "error" ? styles.error : styles.note}>{status}</p>
        <div style={styles.safety}>
          <strong>Safe publish contract</strong>
          <span>Idle-only sessions upload only the new Idle runtime clips; the server preserves the latest Normal/Final dance bundle. Key stays in this tab session only; raw FBX is never published.</span>
        </div>
      </section>
    </>
  );
}

function badgeStyle(state: PublishState): CSSProperties {
  const success = state === "published" || state === "no-changes";
  const error = state === "error";
  const busy = state === "checking" || state === "publishing";
  return {
    borderRadius: 999,
    padding: "6px 8px",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: ".08em",
    color: success ? "#78e8b5" : error ? "#ff9eaa" : busy ? "#dac8ff" : "#a8b0be",
    background: success ? "#12372b" : error ? "#42202a" : busy ? "#2a2041" : "#232832",
  };
}

const styles: Record<string, CSSProperties> = {
  card: { display: "grid", gap: 10, padding: 12, border: "1px solid #355144", borderRadius: 15, background: "#101814" },
  topline: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  kicker: { margin: 0, color: "#75b596", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" },
  latestBox: { display: "grid", gap: 3, padding: 10, borderRadius: 10, background: "#14221b", color: "#9ecbb5", fontSize: 11 },
  selectionBox: { display: "flex", flexWrap: "wrap", gap: 8, padding: 9, borderRadius: 10, background: "#111915", color: "#9ab0a4", fontSize: 10 },
  keyRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 7 },
  keyInput: { minWidth: 0, height: 42, border: "1px solid #385448", borderRadius: 10, background: "#0e1411", color: "#e9f5ee", padding: "0 10px", fontSize: 12 },
  publishButton: { minHeight: 42, border: "1px solid #4e9d75", borderRadius: 10, background: "#17603f", color: "white", padding: "0 12px", fontWeight: 900 },
  note: { margin: 0, color: "#91a99d", fontSize: 11, lineHeight: 1.45 },
  error: { margin: 0, color: "#ff9eaa", fontSize: 11, lineHeight: 1.45 },
  safety: { display: "grid", gap: 3, padding: 10, borderRadius: 10, background: "#121915", color: "#71877c", fontSize: 10, lineHeight: 1.45 },
};
