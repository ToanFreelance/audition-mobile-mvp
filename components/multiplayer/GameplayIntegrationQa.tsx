"use client";

import type { P45QaResult } from "../../multiplayer/gameplay-qa-simulation";
import styles from "./MultiplayerQaPanel.module.css";

function statusClass(pass: boolean) {
  return pass ? styles.pass : styles.fail;
}

export default function GameplayIntegrationQa({ result }: { result: P45QaResult }) {
  const checks = [
    ["Divergent local outcomes", result.divergentOutcomePass],
    ["Shared global turn", result.sharedGlobalTurnPass],
    ["Canonical command", result.canonicalCommandPass],
    ["Finish rest → resume", result.finishRestPass],
    ["Dropped-frame catch-up", result.droppedFrameCatchupPass],
    ["AUDIO END only", result.audioEndOnlyPass],
    ["Judgement metadata", result.resultEventPass],
  ] as const;

  return (
    <section className={styles.notes}>
      <div className={styles.clientHeader}>
        <div>
          <span className={styles.role}>P4.5 · GAMEPLAY INTEGRATION</span>
          <strong>WebAudio-derived Shared Gameplay QA</strong>
        </div>
        <span className={result.pass ? styles.visible : styles.hidden}>
          {result.pass ? "PASS" : "FAIL"}
        </span>
      </div>

      <p>{result.detail}</p>
      <p><b>Locked Finish check:</b> T{result.finishTurn} Finish → four shared rest turns → T{result.resumeTurn} resume.</p>

      <section className={styles.invariants}>
        {checks.map(([name, pass]) => (
          <div className={`${styles.invariant} ${statusClass(pass)}`} key={name}>
            <span>{name}</span>
            <strong>{pass ? "PASS" : "FAIL"}</strong>
          </div>
        ))}
      </section>

      <div className={styles.roomCard}>
        <div><span className={styles.label}>Resume turn</span><strong>T{result.resumeTurn}</strong></div>
        <div><span className={styles.label}>Canonical hash</span><strong>{result.canonicalCommandHash}</strong></div>
        <div><span className={styles.label}>Timeline owner</span><strong>WEBAUDIO</strong></div>
        <div><span className={styles.label}>Network turn authority</span><strong>NONE</strong></div>
      </div>

      <section className={styles.clientGrid}>
        {result.clients.map(client => (
          <article className={styles.clientCard} key={client.participantId}>
            <div className={styles.clientHeader}>
              <div>
                <span className={styles.role}>LOGICAL CLIENT</span>
                <h2>{client.participantId}</h2>
              </div>
              <span className={client.commandVisible ? styles.visible : styles.hidden}>
                {client.commandVisible ? "COMMAND" : "HIDDEN"}
              </span>
            </div>
            <dl>
              <div><dt>Global turn</dt><dd>T{client.globalTurn}</dd></div>
              <div><dt>Global level</dt><dd>{client.globalLevel === null ? "—" : `L${client.globalLevel}`}</dd></div>
              <div><dt>Active command</dt><dd>T{client.activeCommandTurn}</dd></div>
              <div><dt>Score</dt><dd>{client.score}</dd></div>
              <div><dt>Combo</dt><dd>{client.combo}</dd></div>
              <div><dt>Last judgement</dt><dd>{client.lastJudgement?.toUpperCase() ?? "—"}</dd></div>
            </dl>
          </article>
        ))}
      </section>

      <p>Player judgement/result messages are metadata for remote presentation/leaderboard state only. They never advance the room clock or select the canonical command.</p>
    </section>
  );
}
