"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import AssetLabPreview from "@/components/character/AssetLabPreview";
import {
  P37_DANCE_CANDIDATES,
  P37_REFERENCE_CHARACTERS,
} from "@/components/character/asset-catalog";

type DraftDecision = "approved" | "rejected";
type DisplayDecision = DraftDecision | "unreviewed";
type DraftSelections = Record<string, DraftDecision>;
type Filter = "all" | DisplayDecision;

const STORAGE_KEY = "audition:p3.7:asset-lab:draft-selection:v1";

export default function AssetLabPage() {
  const [characterId, setCharacterId] = useState(P37_REFERENCE_CHARACTERS[0].id);
  const [selectedId, setSelectedId] = useState(P37_DANCE_CANDIDATES[0].id);
  const [draftSelections, setDraftSelections] = useState<DraftSelections>({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setDraftSelections(JSON.parse(raw) as DraftSelections);
    } catch {
      // Local review state must never block the internal tool.
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (draftLoaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draftSelections));
  }, [draftLoaded, draftSelections]);

  const character = P37_REFERENCE_CHARACTERS.find(item => item.id === characterId) ?? P37_REFERENCE_CHARACTERS[0];
  const selected = P37_DANCE_CANDIDATES.find(item => item.id === selectedId) ?? P37_DANCE_CANDIDATES[0];
  const selectedDecision = getDecision(draftSelections, selected.id);

  const counts = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    for (const asset of P37_DANCE_CANDIDATES) {
      const decision = getDecision(draftSelections, asset.id);
      if (decision === "approved") approved += 1;
      if (decision === "rejected") rejected += 1;
    }
    return { approved, rejected, unreviewed: P37_DANCE_CANDIDATES.length - approved - rejected };
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
            <p style={styles.eyebrow}>P3.7 · ASSET LAB · 2A-2</p>
            <h1 style={styles.title}>Animation Review</h1>
            <p style={styles.lead}>Choose character → preview dance → approve or reject. Draft decisions stay in this browser only.</p>
          </div>
          <span style={styles.lockBadge}>GAMEPLAY DISCONNECTED</span>
        </header>

        <section style={styles.characterSection}>
          <div style={styles.sectionLabel}>CHARACTER</div>
          <div style={styles.characterButtons}>
            {P37_REFERENCE_CHARACTERS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCharacterId(item.id)}
                style={characterButtonStyle(item.id === character.id)}
              >
                <span style={styles.characterIcon}>{item.sex === "male" ? "♂" : "♀"}</span>
                <span>{item.sex === "male" ? "Male" : "Female"}</span>
              </button>
            ))}
          </div>
        </section>

        <AssetLabPreview character={character} candidate={selected} />

        <section style={styles.selectedCard}>
          <div style={styles.selectedTop}>
            <div>
              <p style={styles.sectionLabel}>SELECTED ANIMATION</p>
              <h2 style={styles.selectedName}>{selected.name}</h2>
            </div>
            <DecisionBadge decision={selectedDecision} />
          </div>

          <div style={styles.reviewActions}>
            <button type="button" onClick={() => setDecision(selected.id, "approved")} style={reviewButtonStyle(selectedDecision === "approved", "approve")}>✓ Approve</button>
            <button type="button" onClick={() => setDecision(selected.id, "rejected")} style={reviewButtonStyle(selectedDecision === "rejected", "reject")}>× Reject</button>
            {selectedDecision !== "unreviewed" && (
              <button type="button" onClick={() => setDecision(selected.id, "unreviewed")} style={styles.clearButton}>Clear</button>
            )}
          </div>

          <button type="button" onClick={() => setDetailsOpen(value => !value)} style={styles.detailsButton}>
            {detailsOpen ? "Hide technical details" : "Technical details"} {detailsOpen ? "▴" : "▾"}
          </button>
          {detailsOpen && (
            <div style={styles.detailsBox}>
              <div>{selected.id}</div>
              <div>{selected.provider} · {selected.format}</div>
              <div>{selected.sourceFileName} · {(selected.bytes / 1024).toFixed(0)} KB</div>
              <code style={styles.hash}>SHA-256 {selected.sha256}</code>
            </div>
          )}
        </section>

        <section style={styles.librarySection}>
          <div style={styles.libraryHeader}>
            <div>
              <p style={styles.sectionLabel}>ANIMATIONS</p>
              <h2 style={styles.libraryTitle}>15 dance candidates</h2>
            </div>
            <div style={styles.countText}>{counts.approved} approved · {counts.rejected} rejected</div>
          </div>

          <div style={styles.filters}>
            {(["all", "unreviewed", "approved", "rejected"] as const).map(value => (
              <button key={value} type="button" onClick={() => setFilter(value)} style={filterButtonStyle(filter === value)}>
                {value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>

          <div style={styles.animationList}>
            {visibleCandidates.map(asset => {
              const decision = getDecision(draftSelections, asset.id);
              const isSelected = asset.id === selected.id;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(asset.id);
                    setDetailsOpen(false);
                  }}
                  style={animationRowStyle(isSelected)}
                >
                  <span style={styles.animationIndex}>{String(P37_DANCE_CANDIDATES.findIndex(item => item.id === asset.id) + 1).padStart(2, "0")}</span>
                  <span style={styles.animationName}>{asset.name}</span>
                  <DecisionDot decision={decision} />
                </button>
              );
            })}
          </div>
        </section>

        <footer style={styles.footer}>
          Source FBX stays private. The preview ZIP is opened locally in the browser and is not uploaded by this tool. Gameplay, WebAudio, Finish, gauge and choreography runtime are untouched.
        </footer>
      </div>
    </main>
  );
}

function getDecision(draft: DraftSelections, id: string): DisplayDecision {
  return draft[id] ?? "unreviewed";
}

function DecisionBadge({ decision }: { decision: DisplayDecision }) {
  return <span style={decisionBadgeStyle(decision)}>{decision.toUpperCase()}</span>;
}

function DecisionDot({ decision }: { decision: DisplayDecision }) {
  return (
    <span style={decisionDotStyle(decision)} aria-label={decision}>
      {decision === "approved" ? "✓" : decision === "rejected" ? "×" : "○"}
    </span>
  );
}

const characterButtonStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "11px 12px",
  borderRadius: 12,
  border: active ? "1px solid #9b74e3" : "1px solid #343946",
  background: active ? "#2b2142" : "#171a21",
  color: active ? "#f0e9ff" : "#aeb5c3",
  fontWeight: 850,
});

const filterButtonStyle = (active: boolean): CSSProperties => ({
  border: active ? "1px solid #8c67cf" : "1px solid #323744",
  background: active ? "#2a2040" : "#171a21",
  color: active ? "#efe7ff" : "#9da6b6",
  borderRadius: 999,
  padding: "8px 11px",
  fontWeight: 800,
  fontSize: 12,
});

const reviewButtonStyle = (active: boolean, kind: "approve" | "reject"): CSSProperties => ({
  flex: 1,
  border: active ? `1px solid ${kind === "approve" ? "#4bd598" : "#ff7184"}` : "1px solid #3b414e",
  background: active ? (kind === "approve" ? "#123b2d" : "#45202a") : "#191d25",
  color: "#f6f8fb",
  borderRadius: 12,
  padding: "12px 14px",
  fontWeight: 900,
});

const animationRowStyle = (selected: boolean): CSSProperties => ({
  width: "100%",
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr) 30px",
  gap: 8,
  alignItems: "center",
  textAlign: "left",
  border: selected ? "1px solid #8a65cc" : "1px solid transparent",
  background: selected ? "#251d37" : "#171a21",
  color: "#e7eaf0",
  borderRadius: 11,
  padding: "10px 9px",
});

const decisionBadgeStyle = (decision: DisplayDecision): CSSProperties => ({
  borderRadius: 999,
  padding: "6px 8px",
  fontSize: 9,
  fontWeight: 950,
  letterSpacing: ".08em",
  color: decision === "approved" ? "#75e9b2" : decision === "rejected" ? "#ff9eaa" : "#a8b0be",
  background: decision === "approved" ? "#12372b" : decision === "rejected" ? "#42202a" : "#232832",
});

const decisionDotStyle = (decision: DisplayDecision): CSSProperties => ({
  width: 26,
  height: 26,
  display: "grid",
  placeItems: "center",
  justifySelf: "end",
  borderRadius: 999,
  color: decision === "approved" ? "#75e9b2" : decision === "rejected" ? "#ff8f9e" : "#6f7888",
  background: decision === "approved" ? "#12372b" : decision === "rejected" ? "#42202a" : "#222630",
  fontWeight: 950,
});

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#0b0d12", color: "#f4f6fb", padding: "18px 12px 40px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  shell: { width: "100%", maxWidth: 760, margin: "0 auto", display: "grid", gap: 12 },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  eyebrow: { margin: 0, color: "#aa82ef", fontSize: 10, fontWeight: 950, letterSpacing: ".13em" },
  title: { margin: "5px 0 5px", fontSize: "clamp(25px, 7vw, 36px)", lineHeight: 1 },
  lead: { margin: 0, maxWidth: 560, color: "#9099aa", fontSize: 12, lineHeight: 1.45 },
  lockBadge: { flex: "0 0 auto", border: "1px solid #514169", color: "#bda7e9", borderRadius: 999, padding: "6px 8px", fontSize: 8, fontWeight: 950, letterSpacing: ".08em" },
  characterSection: { display: "grid", gap: 7, padding: 10, border: "1px solid #282d38", borderRadius: 14, background: "#11141a" },
  sectionLabel: { margin: 0, color: "#7f899a", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" },
  characterButtons: { display: "flex", gap: 8 },
  characterIcon: { fontSize: 18, lineHeight: 1 },
  selectedCard: { display: "grid", gap: 10, padding: 12, border: "1px solid #2a303c", borderRadius: 15, background: "#11141a" },
  selectedTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  selectedName: { margin: "3px 0 0", fontSize: 20 },
  reviewActions: { display: "flex", gap: 8 },
  clearButton: { border: "1px solid #343a46", background: "transparent", color: "#9ca5b4", borderRadius: 12, padding: "12px 11px", fontWeight: 800 },
  detailsButton: { justifySelf: "start", border: 0, background: "transparent", color: "#8d97a8", padding: 0, fontSize: 11, fontWeight: 800 },
  detailsBox: { display: "grid", gap: 4, padding: 10, borderRadius: 10, background: "#181b22", color: "#8e98a9", fontSize: 11 },
  hash: { color: "#727c8c", fontSize: 9, overflowWrap: "anywhere", wordBreak: "break-all" },
  librarySection: { display: "grid", gap: 10, padding: 12, border: "1px solid #282d38", borderRadius: 15, background: "#11141a" },
  libraryHeader: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 10 },
  libraryTitle: { margin: "3px 0 0", fontSize: 18 },
  countText: { color: "#828c9d", fontSize: 10 },
  filters: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 },
  animationList: { display: "grid", gap: 5 },
  animationIndex: { color: "#6f798a", fontSize: 10, fontWeight: 900, textAlign: "center" },
  animationName: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 800 },
  footer: { padding: 11, borderRadius: 11, background: "#13161c", color: "#747e8e", fontSize: 10, lineHeight: 1.45 },
};
