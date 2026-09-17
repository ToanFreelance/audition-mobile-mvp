"use client";

import { useState } from "react";
import { estimateServerNowMs, planSharedAudioStart } from "../../multiplayer/shared-clock";
import { estimateNetworkServerClock } from "../../multiplayer/server-clock-client";
import { SupabaseRealtimeRoomTransport } from "../../multiplayer/supabase-realtime-transport";
import styles from "./MultiplayerQaPanel.module.css";

type RealtimeConfig = {
  transport: "supabase-realtime";
  protocolVersion: 1;
  supabaseUrl: string;
  publishableKey: string;
};

type QaState = {
  phase: "idle" | "running" | "pass" | "fail";
  roomId?: string;
  detail: string;
  presenceCount?: number;
  pingPong?: boolean;
  roomRevision?: boolean;
  sharedEpoch?: boolean;
  hostMinRttMs?: number;
  guestMinRttMs?: number;
};

function uniqueRoomId() {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36);
  return `p43-qa-${suffix}`;
}

async function waitUntil(check: () => boolean, description: string, timeoutMs = 5_000) {
  const started = performance.now();
  while (!check()) {
    if (performance.now() - started > timeoutMs) throw new Error(`${description} timed out.`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function fetchRealtimeConfig(): Promise<RealtimeConfig> {
  const response = await fetch("/api/multiplayer/realtime-config", { cache: "no-store" });
  if (!response.ok) throw new Error(`Realtime config failed (${response.status}).`);
  return response.json() as Promise<RealtimeConfig>;
}

export default function NetworkTransportQa() {
  const [state, setState] = useState<QaState>({
    phase: "idle",
    detail: "Run two real Supabase Realtime clients from this browser. No second phone is required for P4.3 transport QA.",
  });

  const run = async () => {
    if (state.phase === "running") return;
    setState({ phase: "running", detail: "Connecting two real room clients…" });

    const roomId = uniqueRoomId();
    let host: SupabaseRealtimeRoomTransport | null = null;
    let guest: SupabaseRealtimeRoomTransport | null = null;
    const cleanups: Array<() => void> = [];

    try {
      const config = await fetchRealtimeConfig();
      host = new SupabaseRealtimeRoomTransport({
        supabaseUrl: config.supabaseUrl,
        publishableKey: config.publishableKey,
        roomId,
        presence: {
          participantId: "qa-host",
          displayName: "QA Host",
          kind: "human",
          role: "host",
          roomRevision: 7,
        },
      });
      guest = new SupabaseRealtimeRoomTransport({
        supabaseUrl: config.supabaseUrl,
        publishableKey: config.publishableKey,
        roomId,
        presence: {
          participantId: "qa-guest",
          displayName: "QA Guest",
          kind: "human",
          role: "guest",
          roomRevision: 7,
        },
      });

      let hostPresenceCount = 0;
      let guestPresenceCount = 0;
      let pongReceived = false;
      let revisionReceived = false;
      let epochReceived = false;
      let expectedEpoch = 0;
      let pongSendError: Error | null = null;
      const nonce = `ping-${roomId}`;

      cleanups.push(host.onPresence(presence => { hostPresenceCount = presence.length; }));
      cleanups.push(guest.onPresence(presence => { guestPresenceCount = presence.length; }));
      cleanups.push(host.onEvent(event => {
        if (event.payload.kind === "qa-pong" && event.payload.nonce === nonce) pongReceived = true;
      }));
      cleanups.push(guest.onEvent(event => {
        if (event.payload.kind === "qa-ping" && event.payload.nonce === nonce) {
          void guest?.send({ kind: "qa-pong", nonce }).catch(error => {
            pongSendError = error instanceof Error ? error : new Error("Guest pong failed.");
          });
        }
        if (event.payload.kind === "room-revision" && event.payload.roomRevision === 7) revisionReceived = true;
        if (event.payload.kind === "match-start-epoch" && event.payload.startAtServerMs === expectedEpoch) epochReceived = true;
      }));

      await Promise.all([host.connect(), guest.connect()]);
      await waitUntil(() => hostPresenceCount >= 2 && guestPresenceCount >= 2, "Presence convergence");

      setState({
        phase: "running",
        roomId,
        detail: "Presence converged. Sampling the real server clock…",
        presenceCount: Math.min(hostPresenceCount, guestPresenceCount),
      });

      const [hostClock, guestClock] = await Promise.all([
        estimateNetworkServerClock({ sampleCount: 3 }),
        estimateNetworkServerClock({ sampleCount: 3 }),
      ]);

      const estimatedServerNow = estimateServerNowMs(performance.now(), hostClock.estimate.offsetMs);
      expectedEpoch = Math.ceil(estimatedServerNow) + 4_000;
      const guestPlan = planSharedAudioStart({
        startAtServerMs: expectedEpoch,
        estimatedServerOffsetMs: guestClock.estimate.offsetMs,
        localNowMonotonicMs: performance.now(),
        audioContextNowSec: 0,
      });
      if (guestPlan.status !== "scheduled") throw new Error("Guest mapped the shared epoch as late.");

      await host.send({ kind: "room-revision", roomRevision: 7, reason: "other" });
      await host.send({
        kind: "match-start-epoch",
        roomRevision: 7,
        matchId: "p43-qa-match",
        startAtServerMs: expectedEpoch,
      });
      await host.send({ kind: "qa-ping", nonce });

      await waitUntil(() => revisionReceived && epochReceived && pongReceived, "Realtime event exchange");
      if (pongSendError) throw pongSendError;

      setState({
        phase: "pass",
        roomId,
        detail: "Real Supabase Presence + Broadcast + Vercel clock exchange passed. No gameplay turn was sent over the network.",
        presenceCount: Math.min(hostPresenceCount, guestPresenceCount),
        pingPong: true,
        roomRevision: true,
        sharedEpoch: true,
        hostMinRttMs: hostClock.estimate.minRoundTripMs,
        guestMinRttMs: guestClock.estimate.minRoundTripMs,
      });
    } catch (error) {
      setState({
        phase: "fail",
        roomId,
        detail: error instanceof Error ? error.message : "Unknown P4.3 transport QA failure.",
      });
    } finally {
      for (const cleanup of cleanups) cleanup();
      host?.disconnect();
      guest?.disconnect();
    }
  };

  const pass = state.phase === "pass";
  const running = state.phase === "running";

  return (
    <section className={styles.notes}>
      <div className={styles.clientHeader}>
        <div>
          <span className={styles.role}>P4.3 · REAL NETWORK</span>
          <strong>Supabase Realtime Transport QA</strong>
        </div>
        <span className={pass ? styles.visible : state.phase === "fail" ? styles.hidden : styles.role}>
          {running ? "RUNNING" : state.phase.toUpperCase()}
        </span>
      </div>

      <p>{state.detail}</p>
      {state.roomId && <p><b>Ephemeral room:</b> {state.roomId}</p>}

      {(state.presenceCount !== undefined || pass) && (
        <div className={styles.roomCard}>
          <div><span className={styles.label}>Presence</span><strong>{state.presenceCount ?? 0}/2</strong></div>
          <div><span className={styles.label}>Broadcast ping/pong</span><strong>{state.pingPong ? "PASS" : "—"}</strong></div>
          <div><span className={styles.label}>Room revision event</span><strong>{state.roomRevision ? "PASS" : "—"}</strong></div>
          <div><span className={styles.label}>Shared epoch event</span><strong>{state.sharedEpoch ? "PASS" : "—"}</strong></div>
          <div><span className={styles.label}>Host min RTT</span><strong>{state.hostMinRttMs === undefined ? "—" : `${Math.round(state.hostMinRttMs * 10) / 10} ms`}</strong></div>
          <div><span className={styles.label}>Guest min RTT</span><strong>{state.guestMinRttMs === undefined ? "—" : `${Math.round(state.guestMinRttMs * 10) / 10} ms`}</strong></div>
        </div>
      )}

      <div className={styles.buttonRow}>
        <button className={styles.activeButton} disabled={running} onClick={() => void run()} type="button">
          {running ? "Running real transport…" : "Run P4.3 real network QA"}
        </button>
      </div>

      <p>Security note: P4.3 uses an ephemeral public QA channel with a publishable key. Authentication/private-room authorization is not claimed here and remains a later hardening concern.</p>
    </section>
  );
}
