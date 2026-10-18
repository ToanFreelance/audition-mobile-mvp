"use client";

export const C3_START_TRACE_KEY = "audition.c3-start-checkpoints.v1";

export type C3StartCheckpoint = { at: string; step: string };

/** QA-only breadcrumbs survive a WebKit process termination. No room identity,
 * MatchManifest payload or user information is persisted. Not gameplay state. */
export function recordC3StartCheckpoint(step: string): void {
  if (typeof window === "undefined") return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(C3_START_TRACE_KEY) || "[]") as unknown;
    const previous = Array.isArray(stored) ? stored.filter(
      (item): item is C3StartCheckpoint =>
        item && typeof item === "object" && typeof item.step === "string" && typeof item.at === "string",
    ).slice(-19) : [];
    window.localStorage.setItem(C3_START_TRACE_KEY, JSON.stringify([
      ...previous, { at: new Date().toISOString(), step },
    ]));
  } catch {
    // Private browsing/quota errors must never interfere with START.
  }
}
