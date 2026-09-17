"use client";

import { useMemo, useState } from "react";
import {
  runP44QaScenario,
  type P44QaScenarioId,
} from "../../multiplayer/match-start-qa-simulation";
import styles from "./MultiplayerQaPanel.module.css";

const SCENARIOS: readonly { id: P44QaScenarioId; label: string }[] = [
  { id: "normal", label: "A NORMAL" },
  { id: "delayed", label: "B DELAYED" },
  { id: "stale-ack", label: "C STALE ACK" },
  { id: "bot-auto-load", label: "D BOT LOAD" },
  { id: "late-client", label: "E LATE" },
  { id: "cancel-restart", label: "F RESTART" },
  { id: "identical-epoch", label: "G SAME EPOCH" },
];

function formatAudioTime(value: number | null) {
  return value === null ? "—" : `${value.toFixed(3)} s`;
}

export default function MatchStartQa() {
  const [scenarioId, setScenarioId] = useState<P44QaScenarioId>("normal");
  const result = useMemo(() => runP44QaScenario(scenarioId), [scenarioId]);

  return (
    <section className={styles.notes}>
      <div className={styles.clientHeader}>
        <div>
          <span className={styles.role}>P4.4 · START PROTOCOL</span>
          <strong>Preload / All Clients Loaded / Countdown QA</strong>
        </div>
        <span className={result.pass ? styles.visible : styles.hidden}>
          {result.pass ? "PASS" : "FAIL"}
        </span>
      </div>

      <p>{result.detail}</p>

      <div className={styles.buttonRow}>
        {SCENARIOS.map(scenario => (
          <button
            className={scenario.id === scenarioId ? styles.activeButton : styles.button}
            key={scenario.id}
            onClick={() => setScenarioId(scenario.id)}
            type="button"
          >
            {scenario.label}
          </button>
        ))}
      </div>

      <div className={styles.roomCard}>
        <div><span className={styles.label}>Scenario</span><strong>{result.title}</strong></div>
        <div><span className={styles.label}>Match ID</span><strong>{result.matchId}</strong></div>
        <div><span className={styles.label}>Room revision</span><strong>{result.roomRevision}</strong></div>
        <div><span className={styles.label}>Start revision</span><strong>{result.startRevision}</strong></div>
        <div><span className={styles.label}>All clients Loaded</span><strong>{result.allClientsLoaded ? "YES" : "NO"}</strong></div>
        <div><span className={styles.label}>Stale ACK rejection</span><strong>{result.staleAckRejected === null ? "N/A" : result.staleAckRejected ? "PASS" : "FAIL"}</strong></div>
        <div><span className={styles.label}>Server clock sample</span><strong>{result.clockSampleStatus.toUpperCase()}</strong></div>
        <div><span className={styles.label}>Shared startAtServerMs</span><strong>{result.startAtServerMs ?? "—"}</strong></div>
        <div><span className={styles.label}>Countdown from epoch</span><strong>{result.countdownLabel ?? "WAIT"}</strong></div>
      </div>

      <div className={styles.clientGrid}>
        {result.clients.map(client => (
          <article className={styles.clientCard} key={client.participantId}>
            <div className={styles.clientHeader}>
              <div>
                <span className={styles.role}>{client.kind.toUpperCase()} · {client.role.toUpperCase()}</span>
                <h2>{client.displayName}</h2>
              </div>
              <span className={client.state === "loaded" ? styles.visible : styles.hidden}>
                {client.state.toUpperCase()}
              </span>
            </div>
            <dl>
              <div><dt>Participant</dt><dd>{client.participantId}</dd></div>
              <div><dt>Mapped epoch</dt><dd>{client.mappedStartAtServerMs ?? "—"}</dd></div>
              <div><dt>AudioContext start</dt><dd>{formatAudioTime(client.audioContextStartTimeSec)}</dd></div>
              <div><dt>Late</dt><dd>{client.late ? "YES" : "NO"}</dd></div>
            </dl>
          </article>
        ))}
      </div>

      <p>
        Loaded means exact audio/chart/manifest/gameplay identity is ready and the required character/animation runtime is either ready or an approved fallback is prepared. Countdown is display-only and is always derived from the immutable shared epoch.
      </p>
    </section>
  );
}
