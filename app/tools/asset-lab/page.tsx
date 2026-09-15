"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  P37_DANCE_CANDIDATES,
  P37_PRIVATE_SOURCE_PACKAGE,
  P37_REFERENCE_CHARACTERS,
} from "@/components/character/asset-catalog";

type DraftDecision = "approved" | "rejected";
type DisplayDecision = DraftDecision | "unreviewed";
type DraftSelections = Record<string, DraftDecision>;
type Filter = "all" | DisplayDecision;

const STORAGE_KEY = "audition:p3.7:asset-lab:draft-selection:v1";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getDecision = (draft: DraftSelections, id: string): DisplayDecision => draft[id] ?? "unreviewed";

export default function AssetLabPage() {
  const [draftSelections, setDraftSelections] = useState<DraftSelections>({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftSelections;
        if (parsed && typeof parsed === "object") setDraftSelections(parsed);
      }
    } catch {
      // A broken local draft should never block the internal tool.
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draftSelections));
  }, [draftLoaded, draftSelections]);

  const counts = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    for (const asset of P37_DANCE_CANDIDATES) {
      const decision = getDecision(draftSelections, asset.id);
      if (decision === "approved") approved += 1;
      if (decision === "rejected") rejected += 1;
    }
    return {
      approved,
      rejected,
      unreviewed: P37_DANCE_CANDIDATES.length - approved - rejected,
    };
  }, [draftSelections]);

  const visibleCandidates = useMemo(() => {
    if (filter === "all") return P37_DANCE_CANDIDATES;
    return P37_DANCE_CANDIDATES.filter(asset => getDecision(draftSelections, asset.id) === filter);
  }, [draftSelections, filter]);

  const setDecision = (id: string, decision: DisplayDecision) => {
    setDraftSelections(current => {
      const next = { ...current };
      if (decision === "unreviewed") delete next[id];
      else next[id] = decision;
      return next;
    });
  };

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>P3.7 · ASSET LAB · 2A-1</p>
            <h1 style={styles.title}>Character & Animation Catalog</h1>
            <p style={styles.lead}>
              Catalog foundation only. Draft review is stored in this browser and does not publish content or change gameplay.
            </p>
          </div>
          <div style={styles.lockBadge}>GAMEPLAY DISCONNECTED</div>
        </header>

        <section style={styles.notice}>
          <strong>Private source checkpoint verified.</strong>
          <span>
            Supabase / {P37_PRIVATE_SOURCE_PACKAGE.bucket} / {P37_PRIVATE_SOURCE_PACKAGE.object} · {formatBytes(P37_PRIVATE_SOURCE_PACKAGE.bytes)}
          </span>
          <code style={styles.hash}>SHA-256 {P37_PRIVATE_SOURCE_PACKAGE.sha256}</code>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeading}>
            <div>
              <p style={styles.kicker}>REFERENCE CHARACTERS</p>
              <h2 style={styles.h2}>Male / Female rig references</h2>
            </div>
            <span style={styles.muted}>3D preview comes in Step 2A-2</span>
          </div>
          <div style={styles.characterGrid}>
            {P37_REFERENCE_CHARACTERS.map(character => (
              <article key={character.id} style={styles.characterCard}>
                <div style={styles.characterPlaceholder}>{character.sex === "male" ? "♂" : "♀"}</div>
                <div style={{ minWidth: 0 }}>
                  <p style={styles.cardTitle}>{character.name}</p>
                  <p style={styles.meta}>{character.id}</p>
                  <p style={styles.meta}>
                    {character.provider} · {character.family} · {character.format} · {character.license}
                  </p>
                  <p style={styles.meta}>Approx. {character.approxHeightM.toFixed(2)} m · source pinned</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeading}>
            <div>
              <p style={styles.kicker}>DANCE CANDIDATES</p>
              <h2 style={styles.h2}>15 owner-acquired Mixamo motions</h2>
            </div>
            <div style={styles.summaryRow}>
              <Summary label="Approved" value={counts.approved} />
              <Summary label="Rejected" value={counts.rejected} />
              <Summary label="Unreviewed" value={counts.unreviewed} />
            </div>
          </div>

          <div style={styles.toolbar}>
            {(["all", "unreviewed", "approved", "rejected"] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                style={filterButtonStyle(filter === value)}
              >
                {value === "all" ? "All 15" : value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDraftSelections({})}
              disabled={!Object.keys(draftSelections).length}
              style={styles.resetButton}
            >
              Reset draft
            </button>
          </div>

          <div style={styles.list}>
            {visibleCandidates.map(asset => {
              const decision = getDecision(draftSelections, asset.id);
              return (
                <article key={asset.id} style={styles.assetRow}>
                  <div style={styles.assetMain}>
                    <div style={styles.assetTitleRow}>
                      <strong style={styles.assetName}>{asset.name}</strong>
                      <span style={decisionBadgeStyle(decision)}>{decision.toUpperCase()}</span>
                    </div>
                    <p style={styles.meta}>{asset.id} · {asset.sourceFileName} · {formatBytes(asset.bytes)}</p>
                    <p style={styles.meta}>{asset.provider} · {asset.format} · private source persisted</p>
                    <code style={styles.hash}>SHA-256 {asset.sha256}</code>
                  </div>
                  <div style={styles.actions}>
                    <button
                      type="button"
                      onClick={() => setDecision(asset.id, "approved")}
                      style={actionButtonStyle(decision === "approved", "approve")}
                    >
                      ✓ Approve draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision(asset.id, "rejected")}
                      style={actionButtonStyle(decision === "rejected", "reject")}
                    >
                      × Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision(asset.id, "unreviewed")}
                      disabled={decision === "unreviewed"}
                      style={styles.clearButton}
                    >
                      Clear
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {!visibleCandidates.length && <p style={styles.empty}>No candidates in this filter.</p>}
        </section>

        <footer style={styles.footer}>
          <strong>Scope guard:</strong> this page does not load FBX, retarget animation, modify the approved game pool, or touch WebAudio/gameplay timing. Those are later checkpoints.
        </footer>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.summary}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

const filterButtonStyle = (active: boolean): CSSProperties => ({
  border: active ? "1px solid #9d6cff" : "1px solid #343844",
  background: active ? "#2a1f46" : "#171a21",
  color: active ? "#eee5ff" : "#aeb4c2",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 700,
  cursor: "pointer",
});

const actionButtonStyle = (active: boolean, kind: "approve" | "reject"): CSSProperties => ({
  border: active ? `1px solid ${kind === "approve" ? "#54d59b" : "#ff7686"}` : "1px solid #3a3e49",
  background: active ? (kind === "approve" ? "#123c2e" : "#481f29") : "#171a21",
  color: active ? "#ffffff" : "#c6cbd6",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 750,
  cursor: "pointer",
});

const decisionBadgeStyle = (decision: DisplayDecision): CSSProperties => ({
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: ".08em",
  color: decision === "approved" ? "#7bf0b8" : decision === "rejected" ? "#ff9aa7" : "#aeb4c2",
  background: decision === "approved" ? "#123c2e" : decision === "rejected" ? "#481f29" : "#252933",
});

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", padding: "28px 16px 48px", background: "#0d0f14", color: "#f4f6fb", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  shell: { width: "100%", maxWidth: 1080, margin: "0 auto", display: "grid", gap: 18 },
  header: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, alignItems: "flex-start" },
  eyebrow: { margin: 0, color: "#a978ff", fontSize: 12, fontWeight: 900, letterSpacing: ".14em" },
  title: { margin: "7px 0 8px", fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1.05 },
  lead: { maxWidth: 720, margin: 0, color: "#aeb4c2", lineHeight: 1.55 },
  lockBadge: { border: "1px solid #59457d", color: "#c6a9ff", background: "#21182f", borderRadius: 999, padding: "8px 11px", fontSize: 11, fontWeight: 900, letterSpacing: ".08em" },
  notice: { display: "grid", gap: 5, padding: 16, border: "1px solid #2f6a54", borderRadius: 14, background: "#10251e", color: "#c9f7e3" },
  section: { padding: 18, border: "1px solid #2c3039", borderRadius: 18, background: "#12151b" },
  sectionHeading: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "end", marginBottom: 16 },
  kicker: { margin: 0, color: "#8f98aa", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" },
  h2: { margin: "5px 0 0", fontSize: 21 },
  muted: { color: "#808899", fontSize: 12 },
  characterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 },
  characterCard: { display: "flex", gap: 14, padding: 14, border: "1px solid #2f3440", borderRadius: 14, background: "#181b22" },
  characterPlaceholder: { width: 62, height: 72, flex: "0 0 auto", display: "grid", placeItems: "center", borderRadius: 12, background: "#262032", color: "#bc95ff", fontSize: 30, fontWeight: 900 },
  cardTitle: { margin: "1px 0 5px", fontWeight: 800 },
  meta: { margin: "3px 0", color: "#929bab", fontSize: 12, overflowWrap: "anywhere" },
  hash: { color: "#747d8d", fontSize: 10, overflowWrap: "anywhere", wordBreak: "break-all" },
  summaryRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  summary: { minWidth: 78, display: "grid", textAlign: "center", padding: "8px 10px", border: "1px solid #303540", borderRadius: 10, background: "#181b22", color: "#9ba4b5", fontSize: 11 },
  toolbar: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  resetButton: { marginLeft: "auto", border: "1px solid #443d4e", background: "transparent", color: "#aeb4c2", borderRadius: 10, padding: "9px 12px", fontWeight: 700 },
  list: { display: "grid", gap: 9 },
  assetRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 14, padding: 14, border: "1px solid #292e38", borderRadius: 14, background: "#171a21" },
  assetMain: { flex: "1 1 440px", minWidth: 0 },
  assetTitleRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  assetName: { fontSize: 16 },
  actions: { flex: "0 1 360px", display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center", justifyContent: "flex-end" },
  clearButton: { border: "1px solid #333844", background: "transparent", color: "#8f98aa", borderRadius: 10, padding: "10px 11px", fontWeight: 700 },
  empty: { padding: 24, textAlign: "center", color: "#7f8796" },
  footer: { padding: 14, borderRadius: 12, background: "#171a21", color: "#8f98aa", fontSize: 12, lineHeight: 1.5 },
};
