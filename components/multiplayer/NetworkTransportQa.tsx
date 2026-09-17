"use client";

import { useState } from "react";
import type { MultiplayerGameplayJudgementEvent } from "../../multiplayer/gameplay-runtime";
import type { MatchLoadedAck } from "../../multiplayer/match-start-protocol";
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
  loadedAck?: boolean;
  sharedEpoch?: boolean;
  versionedEpoch?: boolean;
  playerJudgement?: boolean;
  hostMinRttMs?: number;
  guestMinRttMs?: number;
};

function uniqueRoomId() {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36);
  return `p45-qa-${suffix}`;
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

function qaLoadedAck(roomId: string): MatchLoadedAck {
  return {
    protocolVersion: 1,
    roomId,
    matchId: "p45-qa-match",
    roomRevision: 7,
    startRevision: 1,
    participantId: "qa-guest",
    content: {
      manifestVersion: 1,
      audioVersion: "qa-audio-v1",
      audioHash: "sha256:qa-audio-v1",
      chartVersion: "qa-chart-v1",
      chartHash: "sha256:qa-chart-v1",
      gameplayConfigVersion: "solo-easy-v1",
      gameplayConfigHash: "sha256:solo-easy-v1",
      characterRuntimeVersion: "character-runtime-v1",
      animationReleaseVersion: 3,
      animationReleaseHash: "sha256:animation-release-v3",
      characterReadiness: "ready",
      animationReadiness: "ready",
    },
  };
}

function qaJudgement(roomId: string): MultiplayerGameplayJudgementEvent {
  return {
    matchId: "p45-qa-match",
    roomId,
    participantId: "qa-guest",
    absoluteTurn: 38,
    judgement: "perfect",
    atSongTimeMs: 100_000,
    targetSpaceMs: 100_000,
    level: 9,
    isFinish: true,
    commandHash: "qa-p45-finish",
  };
}

export default function NetworkTransportQa() {
  const [state, setState] = useState<QaState>({
    phase: "idle",
    detail: "Run two real Supabase Realtime clients from this browser. One physical iPhone is enough for P4.3–P4.5 metadata transport QA.",
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
      let loadedAckReceived = false;
      let epochReceived = false;
      let versionedEpochReceived = false;
      let judgementReceived = false;
      let expectedEpoch = 0;
      let pongSendError: Error | null = null;
      const nonce = `ping-${roomId}`;

      cleanups.push(host.onPresence(presence => { hostPresenceCount = presence.length; }));
      cleanups.push(guest.onPresence(presence => { guestPresenceCount = presence.length; }));
      cleanups.push(host.onEvent(event => {
        if (event.payload.kind === "qa-pong" && event.payload.nonce === nonce) pongReceived = true;
        if (event.payload.kind === "match-loaded-ack"
          && event.payload.ack.matchId === "p45-qa-match"
          && event.payload.ack.startRevision === 1
          && event.payload.ack.participantId === "qa-guest") {
          loadedAckReceived = true;
        }
        if (event.payload.kind === "player-judgement"
          && event.payload.matchId === "p45-qa-match"
          && event.payload.startRevision === 1
          && event.payload.event.participantId === "qa-guest"
          && event.payload.event.absoluteTurn === 38
          && event.payload.event.isFinish) {
          judgementReceived = true;
        }
      }));
      cleanups.push(guest.onEvent(event => {
        if (event.payload.kind === "qa-ping" && event.payload.nonce === nonce) {
          void guest?.send({ kind: "qa-pong", nonce }).catch(error => {
            pongSendError = error instanceof Error ? error : new Error("Guest pong failed.");
          });
        }
        if (event.payload.kind === "room-revision" && event.payload.roomRevision === 7) revisionReceived = true;
        if (event.payload.kind === "match-start-epoch" && event.payload.startAtServerMs === expectedEpoch) epochReceived = true;
        if (event.payload.kind === "match-start-epoch-v2"
          && event.payload.matchId === "p45-qa-match"
          && event.payload.startRevision === 1
          && event.payload.startAtServerMs === expectedEpoch) {
          versionedEpochReceived = true;
        }
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
      expectedEpoch = Math.ceil(estimatedServerNow) + 4_500;
      const guestPlan = planSharedAudioStart({
        startAtServerMs: expectedEpoch,
        estimatedServerOffsetMs: guestClock.estimate.offsetMs,
        localNowMonotonicMs: performance.now(),
        audioContextNowSec: 0,
      });
      if (guestPlan.status !== "scheduled") throw new Error("Guest mapped the shared epoch as late.");

      await guest.send({ kind: "match-loaded-ack", ack: qaLoadedAck(roomId) });
      await guest.send({
        kind: "player-judgement",
        roomRevision: 7,
        matchId: "p45-qa-match",
        startRevision: 1,
        event: qaJudgement(roomId),
      });
      await host.send({ kind: "room-revision", roomRevision: 7, reason: "other" });
      await host.send({
        kind: "match-start-epoch",
        roomRevision: 7,
        matchId: "p45-qa-match",
        startAtServerMs: expectedEpoch,
      });
      await host.send({
        kind: "match-start-epoch-v2",
        roomRevision: 7,
        matchId: "p45-qa-match",
        startRevision: 1,
        startAtServerMs: expectedEpoch,
      });
      await host.send({ kind: "qa-ping", nonce });

      await waitUntil(
        () => revisionReceived && loadedAckReceived && epochReceived && versionedEpochReceived && judgementReceived && pongReceived,
        "Realtime event exchange",
      );
      if (pongSendError) throw pongSendError;

      setState({
        phase: "pass",
        roomId,
        detail: "Real Supabase Presence + Broadcast + Vercel clock exchange passed through P4.5 metadata. Player judgement travelled as metadata only; no gameplay turn authority was sent over the network.",
        presenceCount: Math.min(hostPresenceCount, guestPresenceCount),
        pingPong: true,
        roomRevision: true,
        loadedAck: true,
        sharedEpoch: true,
        versionedEpoch: true,
        playerJudgement: true,
        hostMinRttMs: hostClock.estimate.minRoundTripMs,
        guestMinRttMs: guestClock.estimate.minRoundTripMs,
      });
    } catch (error) {
      setState({
        phase: "fail",
        roomId,
        detail: error instanceof Error ? error.message : "Unknown multiplayer transport QA failure.",
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
          <span className={styles.role}>P4.3–P4.5 · REAL NETWORK</span>
          <strong>Supabase Realtime Metadata QA</strong>
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
          <div><span className={styles.label}>P4.4 Loaded ACK event</span><strong>{state.loadedAck ? "PASS" : "—"}</strong></div>
          <div><span className={styles.label}>P4.3 shared epoch event</span><strong>{state.sharedEpoch ? "PASS" : "—"}</strong></div>
          <div><span className={styles.label}>P4.4 versioned epoch event</span><strong>{state.versionedEpoch ? "PASS" : "—"}</strong></div>
          <div><span className={styles.label}>P4.5 judgement metadata</span><strong>{state.playerJudgement ? "PASS" : "—"}</strong></div>
          <div><span className={styles.label}>Host min RTT</span><strong>{state.hostMinRttMs === undefined ? "—" : `${Math.round(state.hostMinRttMs * 10) / 10} ms`}</strong></div>
          <div><span className={styles.label}>Guest min RTT</span><strong>{state.guestMinRttMs === undefined ? "—" : `${Math.round(state.guestMinRttMs * 10) / 10} ms`}</strong></div>
        </div>
      )}

      <div className={styles.buttonRow}>
        <button className={styles.activeButton} disabled={running} onClick={() => void run()} type="button">
          {running ? "Running real transport…" : "Run P4.3–P4.5 real network QA"}
        </button>
      </div>

      <p>Security note: these checks use an ephemeral public QA channel with a publishable key. Authentication/private-room authorization and authoritative anti-cheat validation remain later hardening scope.</p>
    </section>
  );
}
