"use client";

import { useMemo, useState } from "react";
import { simulateSharedStartClock } from "../../multiplayer/clock-sync-simulation";
import { createP41QaFixture, simulateRoom } from "../../multiplayer/simulated-room";
import type { BotProfile } from "../../multiplayer/types";
import styles from "./MultiplayerQaPanel.module.css";

const TURN_PRESETS = [38, 39, 42, 43, 62, 86, 100] as const;
const HUMAN_PROFILES: readonly BotProfile[] = ["perfect", "miss", "mixed", "passive"];
const LATENCY_PROFILES = [0, 50, 100, 200] as const;

function statusClass(pass: boolean) {
  return pass ? styles.pass : styles.fail;
}

function signedMs(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} ms`;
}

export default function MultiplayerQaPanel() {
  const fixture = useMemo(() => createP41QaFixture(), []);
  const [throughTurn, setThroughTurn] = useState<number>(38);
  const [humanProfile, setHumanProfile] = useState<BotProfile>("miss");
  const [latencyProfileMs, setLatencyProfileMs] = useState<number>(100);
  const result = useMemo(() => simulateRoom({
    room: fixture.room,
    manifest: fixture.manifest,
    throughTurn,
    policyOverrides: { "human-host": humanProfile },
  }), [fixture, throughTurn, humanProfile]);
  const clockResult = useMemo(() => simulateSharedStartClock({
    manifest: fixture.manifest,
    latencyProfileMs,
  }), [fixture, latencyProfileMs]);
  const clockByParticipant = useMemo(() => new Map(
    clockResult.clients.map(client => [client.participantId, client]),
  ), [clockResult]);

  const shared = result.clients[0];
  const overallPass = result.invariants.pass && clockResult.startMappingPass;

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>PHASE 4 / P4.1–P4.2</p>
          <h1>Multiplayer Clock QA</h1>
          <p>1 human host + 5 deterministic bots. Shared start-clock mapping is simulated; no real networking transport yet.</p>
        </div>
        <div className={`${styles.overall} ${statusClass(overallPass)}`}>
          {overallPass ? "SYNC PASS" : "DIVERGENCE"}
        </div>
      </section>

      <section className={styles.controls}>
        <div>
          <span className={styles.label}>Human outcome policy</span>
          <div className={styles.buttonRow}>
            {HUMAN_PROFILES.map(profile => (
              <button
                className={profile === humanProfile ? styles.activeButton : styles.button}
                key={profile}
                onClick={() => setHumanProfile(profile)}
                type="button"
              >
                {profile.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={styles.label}>Global turn preset</span>
          <div className={styles.buttonRow}>
            {TURN_PRESETS.map(turn => (
              <button
                className={turn === throughTurn ? styles.activeButton : styles.button}
                key={turn}
                onClick={() => setThroughTurn(turn)}
                type="button"
              >
                T{turn}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={styles.label}>Simulated round-trip latency</span>
          <div className={styles.buttonRow}>
            {LATENCY_PROFILES.map(latency => (
              <button
                className={latency === latencyProfileMs ? styles.activeButton : styles.button}
                key={latency}
                onClick={() => setLatencyProfileMs(latency)}
                type="button"
              >
                {latency} ms
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.roomCard}>
        <div>
          <span className={styles.label}>Shared timeline</span>
          <strong>T{shared.absoluteTurn}</strong>
        </div>
        <div>
          <span className={styles.label}>Level / sequence</span>
          <strong>L{shared.level} / {shared.sequenceIndex}</strong>
        </div>
        <div>
          <span className={styles.label}>State</span>
          <strong>{shared.isFinish ? "FINISH" : shared.roomRest ? "POST-FINISH REST" : "GLOBAL TURN"}</strong>
        </div>
        <div>
          <span className={styles.label}>Target song time</span>
          <strong>{Math.round(shared.targetSpaceMs)} ms</strong>
        </div>
        <div>
          <span className={styles.label}>Canonical command hash</span>
          <strong>{shared.commandHash}</strong>
        </div>
        <div>
          <span className={styles.label}>Shared start epoch</span>
          <strong>{clockResult.startAtServerMs} ms</strong>
        </div>
        <div>
          <span className={styles.label}>Clock QA RTT profile</span>
          <strong>{latencyProfileMs} ms</strong>
        </div>
        <div>
          <span className={styles.label}>Max expected song drift</span>
          <strong>{signedMs(clockResult.maxAbsoluteDriftMs)}</strong>
        </div>
      </section>

      <section className={styles.invariants}>
        {[
          ["Turn", result.invariants.turnSync],
          ["Level", result.invariants.levelSync],
          ["Finish", result.invariants.finishSync],
          ["Target", result.invariants.targetSync],
          ["Command", result.invariants.commandSync],
          ["Start clock", clockResult.startMappingPass],
        ].map(([name, pass]) => (
          <div className={`${styles.invariant} ${statusClass(Boolean(pass))}`} key={String(name)}>
            <span>{name}</span>
            <strong>{pass ? "PASS" : "FAIL"}</strong>
          </div>
        ))}
      </section>

      <section className={styles.clientGrid}>
        {result.clients.map(client => {
          const clock = clockByParticipant.get(client.participantId);
          return (
            <article className={styles.clientCard} key={client.participantId}>
              <div className={styles.clientHeader}>
                <div>
                  <span className={styles.role}>{client.kind === "human" ? "HUMAN" : "BOT"} · {client.role.toUpperCase()}</span>
                  <h2>{client.displayName}</h2>
                </div>
                <span className={client.commandVisible ? styles.visible : styles.hidden}>
                  {client.commandVisible ? "COMMAND" : "HIDDEN"}
                </span>
              </div>
              <dl>
                <div><dt>Turn</dt><dd>T{client.absoluteTurn}</dd></div>
                <div><dt>Level</dt><dd>L{client.level}</dd></div>
                <div><dt>Judgement</dt><dd>{client.judgement?.toUpperCase() ?? "—"}</dd></div>
                <div><dt>Hash</dt><dd>{client.commandHash}</dd></div>
                <div><dt>Clock estimate error</dt><dd>{clock ? signedMs(clock.offsetErrorMs) : "—"}</dd></div>
                <div><dt>Expected song drift</dt><dd>{clock ? signedMs(clock.expectedSongDriftMs) : "—"}</dd></div>
                <div><dt>Audio schedule</dt><dd>{clock?.scheduleStatus.toUpperCase() ?? "—"}</dd></div>
              </dl>
            </article>
          );
        })}
      </section>

      <section className={styles.notes}>
        <strong>Locked P4.1–P4.2 semantics</strong>
        <p>Host has no Ready state. Bots are auto-ready. T38 Finish is shared; T39–T42 are room-wide rest; T43 resumes L6 for every participant regardless of Finish judgement.</p>
        <p>P4.2 maps one immutable server start epoch onto each client&apos;s local monotonic/AudioContext clock. Latency changes the clock estimate, never the global turn, Finish cadence, command seed, or room start epoch.</p>
        <p>Drift shown here is observational QA only. P4.2 does not seek, stretch, pause, repeat, or otherwise correct active WebAudio playback.</p>
      </section>
    </main>
  );
}
