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

const PUBLISH_ENDPOINT = "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-animation-publish";
const KEY_STORAGE = "audition:p3.7:asset-lab:publish-key:session";

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
  publishedAt?: string;
};

type PublishPayload = {
  error?: string;
  noChanges?: boolean;
  release?: {
    releaseVersion?: number;
    clipCount?: number;
    normalIds?: string[];
    finalIds?: string[];
    publishedAt?: string;
  };
};

export default function AssetLabPublisher({ decisions, roles }: Props) {
  const [publishKey, setPublishKey] = useState("");
  const [state, setState] = useState<PublishState>("idle");
  const [status, setStatus] = useState("Approved + READY role-assigned clips can be published as an immutable game-content release.");
  const [latest, setLatest] = useState<LatestRelease | null>(null);

  const normalizedRoles = useMemo(() => normalizeDancePoolRoles(decisions, roles), [decisions, roles]);
  const normalIds = useMemo(
    () => P37_DANCE_CANDIDATES.filter(asset => decisions[asset.id] === "approved" && normalizedRoles[asset.id]?.normal).map(asset => asset.id),
    [decisions, normalizedRoles],
  );
  const finalIds = useMemo(
    () => P37_DANCE_CANDIDATES.filter(asset => decisions[asset.id] === "approved" && normalizedRoles[asset.id]?.final).map(asset => asset.id),
    [decisions, normalizedRoles],
  );
  const publishIds = useMemo(() => [...new Set([...normalIds, ...finalIds])], [normalIds, finalIds]);

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
        const processingIds = Array.isArray(bundle.processingIds) ? bundle.processingIds : [];
        const latestNormal = Array.isArray(bundle.normalIds) ? bundle.normalIds : processingIds;
        const latestFinal = Array.isArray(bundle.finalIds) ? bundle.finalIds : [];
        return {
          releaseVersion: Number(bundle.releaseVersion ?? 0),
          clipCount: Number(bundle.clipCount ?? processingIds.length),
          normalCount: latestNormal.length,
          finalCount: latestFinal.length,
          publishedAt: typeof bundle.publishedAt === "string" ? bundle.publishedAt : undefined,
        } satisfies LatestRelease;
      })
      .then(value => { if (!cancelled) setLatest(value); })
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
    if (!normalIds.length) {
      setState("error");
      setStatus("Assign at least one approved animation to the NORMAL pool before publishing.");
      return;
    }
    if (!publishKey.trim()) {
      setState("error");
      setStatus("Enter the owner publish key first.");
      return;
    }

    setState("checking");
    setStatus(`Checking ${publishIds.length} unique Normal/Final clip(s) in the runtime cache…`);

    try {
      const cached = await listCachedRuntimeClips(publishIds);
      const missing = publishIds.filter(id => !cached.has(id));
      if (missing.length) {
        throw new Error(`${missing.length} selected animation(s) are not runtime READY yet`);
      }

      const clips = publishIds.map(id => cached.get(id)!);
      setState("publishing");
      setStatus("Checking canonical Normal/Final content and publishing only if it changed…");

      const response = await fetch(PUBLISH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Asset-Lab-Publish-Key": publishKey.trim(),
        },
        body: JSON.stringify({
          schemaVersion: 1,
          kind: "audition-animation-publish-request",
          poolId: P37_DANCE_POOL_ID,
          poolVersion: P37_DANCE_POOL_VERSION,
          sourceVersion: P37_DANCE_POOL_SOURCE_VERSION,
          approvedIds: publishIds,
          normalIds,
          finalIds,
          clips,
        }),
      });

      const payload = await response.json() as PublishPayload;
      if (!response.ok) throw new Error(payload.error ?? `Publish failed (${response.status})`);

      const releaseVersion = Number(payload.release?.releaseVersion ?? 0);
      const releasedNormalIds = payload.release?.normalIds ?? normalIds;
      const releasedFinalIds = payload.release?.finalIds ?? finalIds;
      setLatest({
        releaseVersion,
        clipCount: Number(payload.release?.clipCount ?? clips.length),
        normalCount: releasedNormalIds.length,
        finalCount: releasedFinalIds.length,
        publishedAt: payload.release?.publishedAt,
      });

      if (payload.noChanges) {
        setState("no-changes");
        setStatus(`No changes · release v${releaseVersion} already contains this Normal/Final runtime content.`);
        return;
      }

      setState("published");
      setStatus(`Published release v${releaseVersion} · ${normalIds.length} normal · ${finalIds.length} final · ${clips.length} unique clip(s).`);
    } catch (error) {
      setState("error");
      setStatus(error instanceof Error ? error.message : "Unknown publish error");
    }
  };

  return (
    <section style={styles.card}>
      <div style={styles.topline}>
        <div>
          <p style={styles.kicker}>PUBLISH</p>
          <strong>Normal + Final pools → canonical release</strong>
        </div>
        <span style={badgeStyle(state)}>
          {state === "published" ? "PUBLISHED" : state === "no-changes" ? "NO CHANGES" : state.toUpperCase()}
        </span>
      </div>

      {latest && latest.releaseVersion > 0 && (
        <div style={styles.latestBox}>
          <strong>Latest: release v{latest.releaseVersion}</strong>
          <span>{latest.normalCount} normal · {latest.finalCount} final · {latest.clipCount} unique runtime clip(s){latest.publishedAt ? ` · ${new Date(latest.publishedAt).toLocaleString()}` : ""}</span>
        </div>
      )}

      <div style={styles.selectionBox}>
        <span><b>NORMAL</b> {normalIds.length}</span>
        <span><b>FINAL</b> {finalIds.length}</span>
        <span><b>UNIQUE</b> {publishIds.length}</span>
      </div>

      <div style={styles.keyRow}>
        <input
          type="password"
          autoComplete="off"
          value={publishKey}
          onChange={event => updateKey(event.target.value)}
          placeholder="Owner publish key"
          style={styles.keyInput}
          aria-label="Owner publish key"
        />
        <button
          type="button"
          onClick={() => void publish()}
          disabled={state === "checking" || state === "publishing"}
          style={styles.publishButton}
        >
          {state === "publishing" ? "Publishing…" : `Publish ${normalIds.length}N · ${finalIds.length}F`}
        </button>
      </div>

      <p style={state === "error" ? styles.error : styles.note}>{status}</p>
      <div style={styles.safety}>
        <strong>Safe publish contract</strong>
        <span>Key stays in this tab session only. Raw FBX is never published. Role-only changes create a new immutable release without rebaking; unchanged Normal/Final content reuses the latest release.</span>
      </div>
    </section>
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
