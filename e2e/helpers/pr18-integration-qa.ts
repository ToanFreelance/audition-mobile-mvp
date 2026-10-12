/**
 * PR #18 scoped E2E helpers. Import into a real-Supabase browser harness.
 * These helpers never simulate RoomState, Realtime or WebAudio and never
 * classify an HTTP response event alone as a successful JOIN / GAMEPLAY.
 */
import type { Page } from "@playwright/test";

export type QaCanonicalRoom = {
  roomId: string;
  revision: number;
  status: string;
  participants: Array<{ participantId: string; kind: string; loadState?: string }>;
  matchStart?: { startAtServerMs?: number | null; matchId?: string } | null;
};

export type CanonicalReader = (roomId: string, signal: AbortSignal) => Promise<QaCanonicalRoom>;

export type JoinProbeResult = {
  elapsedMs: number;
  roomId: string;
  participantId: string;
  canonicalRevision: number;
  path: string;
  readyButtonVisible: boolean;
};

export type JoinFailureCode =
  | "JOIN_NOT_COMMITTED"
  | "JOIN_UI_NOT_SETTLED"
  | "JOIN_CANONICAL_QUERY_FAILED"
  | "JOIN_PAGE_CLOSED";

export class QaJoinConvergenceError extends Error {
  constructor(
    public readonly code: JoinFailureCode,
    public readonly diagnostics: Record<string, unknown>,
  ) {
    super(`PR18 ${code}: ${JSON.stringify(diagnostics)}`);
    this.name = "QaJoinConvergenceError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function canonicalWithin(
  readCanonical: CanonicalReader,
  roomId: string,
  timeoutMs: number,
): Promise<QaCanonicalRoom> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readCanonical(roomId, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Canonical read deadline exceeded"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Call AFTER the actual Guest clicks JOIN. Do not retry JOIN from here:
 * a timed-out mutation may already have committed on the server.
 *
 * A pass requires BOTH canonical participant membership and the real
 * browser on /rooms/<roomId> with its READY control present.
 *
 * The supplied reader MUST query the real GET /api/multiplayer/room and
 * pass AbortSignal to fetch, not a local shim; do not use this helper to
 * label mocked tests as real-Supabase integration acceptance.
 */
export async function waitForJoinConvergence(args: {
  page: Page;
  roomId: string;
  participantId: string;
  readCanonical: CanonicalReader;
  timeoutMs?: number;
  pollMs?: number;
  requestTimeoutMs?: number;
}): Promise<JoinProbeResult> {
  const { page, roomId, participantId, readCanonical } = args;
  const timeoutMs = args.timeoutMs ?? 45_000;
  const pollMs = args.pollMs ?? 400;
  const requestTimeoutMs = args.requestTimeoutMs ?? 3_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid JOIN timeout");
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  const wantedPath = `/rooms/${encodeURIComponent(roomId)}`;
  let canonicalJoined = false;
  let lastRevision: number | null = null;
  let canonicalError: string | null = null;
  let lastPath = "";
  let readyVisible = false;

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      throw new QaJoinConvergenceError("JOIN_PAGE_CLOSED", { roomId, participantId, elapsedMs: Date.now() - startedAt });
    }
    const remainingMs = deadline - Date.now();
    try {
      // Bound EVERY canonical read. Never pin a five-browser worker
      // forever on a slow PostgREST GET response.
      const room = await canonicalWithin(
        readCanonical, roomId,
        Math.min(requestTimeoutMs, Math.max(100, remainingMs)),
      );
      if (room.roomId === roomId) {
        lastRevision = room.revision;
        canonicalJoined = room.participants.some(
          p => p.participantId === participantId && p.kind === "human",
        );
      } else {
        canonicalJoined = false;
      }
      canonicalError = null;
    } catch (error) {
      // A failed canonical GET must never validate a previous membership snapshot.
      // JOIN PASS requires a successful canonical read in this polling cycle.
      canonicalJoined = false;
      canonicalError = error instanceof Error ? error.message : String(error);
    }
    try {
      lastPath = new URL(page.url()).pathname;
      readyVisible = await page.getByTestId("ready-button").isVisible();
    } catch {
      readyVisible = false;
    }
    // A visibility query may resolve after the deadline under browser load.
    if (Date.now() < deadline && canonicalJoined && lastPath === wantedPath && readyVisible) {
      return { elapsedMs: Date.now() - startedAt, roomId, participantId,
        canonicalRevision: lastRevision ?? 0, path: lastPath, readyButtonVisible: true };
    }
    await sleep(Math.min(pollMs, Math.max(1, deadline - Date.now())));
  }

  const code: JoinFailureCode = canonicalError
    ? "JOIN_CANONICAL_QUERY_FAILED"
    : canonicalJoined ? "JOIN_UI_NOT_SETTLED" : "JOIN_NOT_COMMITTED";
  let pageDiagnostics: Record<string, unknown> | null = null;
  if (!page.isClosed()) {
    pageDiagnostics = await page.evaluate(() => {
      const w = window as unknown as {
        __qaRequests?: Array<{url?:string;status?:number|null;finishedAt?:number;error?:unknown}>;
      };
      return {
        visibleError: document.querySelector('[role="alert"]')?.textContent ?? null,
        bodyExcerpt: document.body.innerText.slice(0, 350),
        pendingRoomRequests: (w.__qaRequests ?? [])
          .filter(r => r.url?.includes("/api/multiplayer/room"))
          .slice(-12).map(r => ({ url: r.url?.split("?")[0], status: r.status, pending: !r.finishedAt, error: r.error })),
      };
    }).catch(() => null);
  }
  throw new QaJoinConvergenceError(code, {
    roomId, participantId, elapsedMs: Date.now() - startedAt,
    canonicalJoined, canonicalRevision: lastRevision, canonicalError,
    actualPath: lastPath, readyVisible, pageDiagnostics,
  });
}

export type HandoffDomEvent = {
  atPerfMs: number;
  atEpochMs: number;
  kind: "lobby" | "gameplay" | "neither";
  audioContextState: string | null;
  roomStatus: string | null;
};

/**
 * Install BEFORE page.goto('/rooms/...'). Records only state transitions
 * every 250 ms; it does not intercept network, AudioContext or React.
 * In a saturated browser, intervals themselves may be delayed; treat
 * event timestamps as observational evidence, not authoritative clock.
 */
export async function installGameplayHandoffDomProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Events = Array<{
      atPerfMs: number; atEpochMs: number; kind: string;
      audioContextState: string | null; roomStatus: string | null;
    }>;
    const w = window as unknown as { __pr18HandoffEvents?: Events };
    w.__pr18HandoffEvents = [];
    let previous = "";
    let handle = 0;
    const capture = () => {
      const gameplay = document.querySelector('[data-testid="multiplayer-gameplay-live"]');
      const lobby = document.querySelector('[data-testid="lobby-root"]');
      const kind = gameplay ? "gameplay" : lobby ? "lobby" : "neither";
      const audioContextState = gameplay?.getAttribute("data-audio-context") ?? null;
      const roomStatus = gameplay?.getAttribute("data-room-status") ?? lobby?.getAttribute("data-room-status") ?? null;
      const next = JSON.stringify([kind, audioContextState, roomStatus]);
      if (next !== previous) {
        previous = next;
        const events = w.__pr18HandoffEvents!;
        events.push({ atPerfMs: performance.now(), atEpochMs: performance.timeOrigin + performance.now(),
          kind, audioContextState, roomStatus });
        if (events.length > 80) events.shift();
      }
    };
    document.addEventListener("DOMContentLoaded", () => {
      capture();
      handle = window.setInterval(capture, 250);
    }, { once: true });
    window.addEventListener("pagehide", () => window.clearInterval(handle), { once: true });
  });
}

/** Failure-time-only snapshot: no production code changes and no fake scores. */
export async function captureGameplayHandoffDiagnostics(page: Page): Promise<Record<string, unknown>> {
  if (page.isClosed()) return { pageClosed: true };
  const state = await page.evaluate(() => {
    const w = window as unknown as {
      __pr18HandoffEvents?: HandoffDomEvent[];
      __qaSources?: unknown[];
      __audSamples?: Array<{epoch?:number;sourceStarts?:number;songRuntime?:number;state?:string;at?:number}>;
      __audLongTasks?: Array<{duration?:number;at?:number}>;
      __qaRead?: () => unknown;
    };
    let runtime: unknown = null;
    try { runtime = w.__qaRead?.() ?? null; } catch { runtime = { readError: true }; }
    const el = document.querySelector('[data-testid="multiplayer-gameplay-live"]');
    return {
      capturedAtEpochMs: performance.timeOrigin + performance.now(),
      visibility: document.visibilityState,
      gameplayDomPresent: Boolean(el),
      gameplayDomVisible: Boolean(el && el.getClientRects().length),
      lobbyDomPresent: Boolean(document.querySelector('[data-testid="lobby-root"]')),
      roomStatusAttribute: el?.getAttribute("data-room-status") ?? null,
      audioStateAttribute: el?.getAttribute("data-audio-context") ?? null,
      sourceStarts: w.__qaSources?.length ?? null,
      recentAudio: w.__audSamples?.slice(-8) ?? [],
      longTasks: w.__audLongTasks?.slice(-30) ?? [],
      domTransitions: w.__pr18HandoffEvents?.slice(-80) ?? [],
      runtime,
    };
  }).catch(error => ({ probeError: error instanceof Error ? error.message : String(error) }));
  return { url: page.url(), ...state };
}

/**
 * Observe mounting deadline. A screenshot captured AFTER the deadline
 * showing gameplay does not retroactively convert a timeout into PASS.
 */
export async function waitForGameplayDom(args: {
  page: Page;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<{ elapsedMs: number; diagnostics: Record<string, unknown> }> {
  const { page } = args;
  const startedAt = Date.now();
  const deadline = startedAt + (args.timeoutMs ?? 75_000);
  while (Date.now() < deadline && !page.isClosed()) {
    const visible = await page.getByTestId("multiplayer-gameplay-live").isVisible().catch(() => false);
    // A late observation is evidence of a timeout, never an on-time PASS.
    if (visible && Date.now() < deadline) {
      return { elapsedMs: Date.now() - startedAt, diagnostics: await captureGameplayHandoffDiagnostics(page) };
    }
    await sleep(Math.min(args.pollMs ?? 500, Math.max(1, deadline - Date.now())));
  }
  const diagnostics = await captureGameplayHandoffDiagnostics(page);
  throw Object.assign(new Error("PR18 GAMEPLAY_DOM_NOT_VISIBLE_WITHIN_DEADLINE"), { diagnostics });
}
