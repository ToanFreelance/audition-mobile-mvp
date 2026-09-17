"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getCachedRuntimeClip, putCachedRuntimeClip } from "./asset-lab-runtime-cache";
import { readVerifiedAssetZip, type LocalAssetZip } from "./asset-lab-local-package";
import { P37AssetLabRuntimeProcessor } from "./asset-lab-runtime-processor";
import {
  P51_IDLE_CANDIDATES,
  P51_IDLE_POOL_VERSION,
  P51_IDLE_SOURCE_PACKAGE,
} from "./idle-animation-catalog";

type RuntimeStatus = "idle" | "waiting-source" | "processing" | "ready" | "error";
type Props = { onReadyIdleIdsChange: (ids: string[]) => void };

const ENABLED_STORAGE_KEY = "audition:p5.1c:idle-pool:enabled:v1";

export default function IdleAssetLabSection({ onReadyIdleIdsChange }: Props) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(P51_IDLE_CANDIDATES.map(asset => [asset.id, true])),
  );
  const [statuses, setStatuses] = useState<Record<string, RuntimeStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [archive, setArchive] = useState<LocalAssetZip | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [packageState, setPackageState] = useState<"idle" | "verifying" | "ready" | "error">("idle");
  const [packageMessage, setPackageMessage] = useState("Choose the owner-local idle ZIP when a selected clip is not already cached.");
  const processorRef = useRef<P37AssetLabRuntimeProcessor | null>(null);
  const runningRef = useRef(false);
  const statusesRef = useRef<Record<string, RuntimeStatus>>({});
  const archiveRef = useRef<LocalAssetZip | null>(null);

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
      return next;
    });
  }, []);

  const runQueue = useCallback(async () => {
    if (!cacheLoaded || runningRef.current) return;
    const currentArchive = archiveRef.current;

    if (!currentArchive) {
      for (const asset of P51_IDLE_CANDIDATES) {
        if (enabled[asset.id] && statusesRef.current[asset.id] !== "ready") {
          updateStatus(asset.id, "waiting-source");
        }
      }
      return;
    }

    runningRef.current = true;
    processorRef.current ??= new P37AssetLabRuntimeProcessor();
    try {
      while (true) {
        const asset = P51_IDLE_CANDIDATES.find(candidate => {
          if (!enabled[candidate.id]) return false;
          const status = statusesRef.current[candidate.id] ?? "idle";
          return status !== "ready" && status !== "processing" && status !== "error";
        });
        if (!asset) break;

        updateStatus(asset.id, "processing");
        try {
          const record = await processorRef.current.process(currentArchive, asset);
          if (record.sourceSha256 !== asset.sha256) throw new Error("Processed idle checksum does not match catalog");
          await putCachedRuntimeClip(record);
          updateStatus(asset.id, "ready");
        } catch (error) {
          updateStatus(asset.id, "error", error instanceof Error ? error.message : "Unknown idle processing error");
        }
        await nextFrame();
      }
    } finally {
      runningRef.current = false;
    }
  }, [cacheLoaded, enabled, updateStatus]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ENABLED_STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Record<string, boolean>;
        setEnabled(Object.fromEntries(P51_IDLE_CANDIDATES.map(asset => [asset.id, stored[asset.id] !== false])));
      }
    } catch {
      // Owner-local selection convenience only.
    }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(ENABLED_STORAGE_KEY, JSON.stringify(enabled)); } catch {}
    void runQueue();
  }, [enabled, runQueue]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(P51_IDLE_CANDIDATES.map(async asset => {
      const cached = await getCachedRuntimeClip(asset.id);
      return cached?.sourceSha256 === asset.sha256 ? asset.id : null;
    })).then(ids => {
      if (cancelled) return;
      const next: Record<string, RuntimeStatus> = {};
      for (const id of ids) if (id) next[id] = "ready";
      statusesRef.current = next;
      setStatuses(next);
      setCacheLoaded(true);
    }).catch(error => {
      if (cancelled) return;
      console.warn("[asset-lab] idle cache restore failed", error);
      setCacheLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const readyIds = P51_IDLE_CANDIDATES
      .filter(asset => enabled[asset.id] && statuses[asset.id] === "ready")
      .map(asset => asset.id);
    onReadyIdleIdsChange(readyIds);
  }, [enabled, onReadyIdleIdsChange, statuses]);

  useEffect(() => () => {
    processorRef.current?.dispose();
    processorRef.current = null;
  }, []);

  const choosePackage = async (file: File | undefined) => {
    if (!file) return;
    setPackageState("verifying");
    setPackageMessage("Verifying idle source ZIP SHA-256…");
    try {
      const verified = await readVerifiedAssetZip(file, P51_IDLE_SOURCE_PACKAGE.sha256);
      const missing = P51_IDLE_CANDIDATES.filter(asset => !verified.archive.has(asset.sourceFileName));
      if (missing.length) throw new Error(`Idle ZIP is missing ${missing.length} expected FBX file(s)`);
      archiveRef.current = verified.archive;
      setArchive(verified.archive);
      setPackageState("ready");
      setPackageMessage(`Verified ${P51_IDLE_CANDIDATES.length} private Mixamo idle sources · processing selected clips…`);
      for (const asset of P51_IDLE_CANDIDATES) {
        if (enabled[asset.id] && statusesRef.current[asset.id] !== "ready") updateStatus(asset.id, "idle");
      }
      queueMicrotask(() => void runQueue());
    } catch (error) {
      archiveRef.current = null;
      setArchive(null);
      setPackageState("error");
      setPackageMessage(error instanceof Error ? error.message : "Idle source ZIP verification failed");
    }
  };

  const toggle = (assetId: string) => setEnabled(current => ({ ...current, [assetId]: !current[assetId] }));
  const readyCount = useMemo(
    () => P51_IDLE_CANDIDATES.filter(asset => enabled[asset.id] && statuses[asset.id] === "ready").length,
    [enabled, statuses],
  );
  const enabledCount = P51_IDLE_CANDIDATES.filter(asset => enabled[asset.id]).length;

  return (
    <section style={styles.card}>
      <div style={styles.topline}>
        <div>
          <p style={styles.kicker}>P5.1c · IDLE POOL</p>
          <strong>Waiting Room Idle Library</strong>
        </div>
        <span style={styles.countBadge}>v{P51_IDLE_POOL_VERSION} · {readyCount}/{enabledCount} READY</span>
      </div>

      <p style={styles.note}>
        Each participant selects one enabled idle deterministically from the published pool. Different participants may use the same or different clips, and clients agree on the selection.
      </p>

      <div style={styles.list}>
        {P51_IDLE_CANDIDATES.map((asset, index) => {
          const active = enabled[asset.id];
          const status = statuses[asset.id] ?? (cacheLoaded && active ? "waiting-source" : "idle");
          return (
            <button key={asset.id} type="button" onClick={() => toggle(asset.id)} style={idleRowStyle(active)}>
              <span style={styles.index}>{String(index + 1).padStart(2, "0")}</span>
              <span style={styles.nameBlock}>
                <strong>{asset.name}</strong>
                <small>{active ? "IN IDLE POOL" : "EXCLUDED"}{errors[asset.id] ? ` · ${errors[asset.id]}` : ""}</small>
              </span>
              <span style={runtimeBadgeStyle(status)}>{status === "waiting-source" ? "WAIT ZIP" : status.toUpperCase()}</span>
            </button>
          );
        })}
      </div>

      <label style={styles.chooseButton}>
        {archive ? "Idle source ZIP verified" : "Choose idle_mixamo_source_pack.zip"}
        <input type="file" accept=".zip,application/zip" style={{ display: "none" }} onChange={event => void choosePackage(event.target.files?.[0])} />
      </label>
      <p style={packageState === "error" ? styles.error : styles.note}>{packageMessage}</p>
      <p style={styles.safety}>Raw FBX stays owner-local. Only baked quaternion runtime clips can enter the canonical release.</p>
    </section>
  );
}

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function idleRowStyle(active: boolean): CSSProperties {
  return {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "30px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 8,
    textAlign: "left",
    border: active ? "1px solid #3d7e69" : "1px solid #303542",
    borderRadius: 11,
    background: active ? "#11241e" : "#171a21",
    color: active ? "#e9fff6" : "#858e9c",
    padding: "9px 10px",
  };
}

function runtimeBadgeStyle(status: RuntimeStatus): CSSProperties {
  return {
    borderRadius: 999,
    padding: "5px 7px",
    fontSize: 8,
    fontWeight: 950,
    color: status === "ready" ? "#7bf0b8" : status === "error" ? "#ff9eaa" : status === "processing" ? "#d9c8ff" : "#9aa3b2",
    background: status === "ready" ? "#12372b" : status === "error" ? "#42202a" : status === "processing" ? "#2a2041" : "#232832",
  };
}

const styles: Record<string, CSSProperties> = {
  card: { display: "grid", gap: 10, padding: 12, border: "1px solid #315449", borderRadius: 15, background: "#101713" },
  topline: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  kicker: { margin: 0, color: "#78c6a8", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" },
  countBadge: { borderRadius: 999, padding: "6px 8px", background: "#183027", color: "#9fe2c7", fontSize: 9, fontWeight: 900 },
  note: { margin: 0, color: "#92a49c", fontSize: 11, lineHeight: 1.45 },
  error: { margin: 0, color: "#ff9eaa", fontSize: 11, lineHeight: 1.45 },
  list: { display: "grid", gap: 6 },
  index: { color: "#66877a", fontSize: 9, fontWeight: 900 },
  nameBlock: { display: "grid", gap: 2, minWidth: 0 },
  chooseButton: { minHeight: 42, display: "grid", placeItems: "center", border: "1px solid #4c9578", borderRadius: 10, background: "#17543d", color: "white", fontWeight: 900, fontSize: 11 },
  safety: { margin: 0, padding: 9, borderRadius: 9, background: "#121a16", color: "#72877e", fontSize: 10, lineHeight: 1.45 },
};
