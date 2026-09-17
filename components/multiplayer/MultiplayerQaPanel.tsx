"use client";

import { useMemo, useState } from "react";
import { createP41QaFixture, simulateRoom } from "../../multiplayer/simulated-room";
import type { BotProfile } from "../../multiplayer/types";
import styles from "./MultiplayerQaPanel.module.css";

const TURN_PRESETS = [38, 39, 42, 43, 62, 86, 100] as const;
const HUMAN_PROFILES: readonly BotProfile[] = ["perfect", "miss", "mixed", "passive"];

function statusClass(pass: boolean) {
  return pass ? styles.pass : styles.fail;
}

export default function MultiplayerQaPanel() {
  const fixture = useMemo(() => createP41QaFixture(), []);
  const [throughTurn, setThroughTurn] = useState<number>(38);
  const [humanProfile, setHumanProfile] = useState<BotProfile>("miss");
  const result = useMemo(() => simulateRoom({
    room: fixture.room,
    manifest: fixture.manifest,
    throughTurn,
    policyOverrides: { "human-host": humanProfile },
  }), [fixture, throughTurn, humanProfile]);

  const shared = result.clients[0];

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>PHASE 4 / P4.1</p>
          <h1>Multiplayer Deterministic QA</h1>
          <p>1 human host + 5 deterministic bots. No networking transport yet.</p>
        </div>
        <div className={`${styles.overall} ${statusClass(result.invariants.pass)}`}>
          {result.invariants.pass ? "SYNC PASS" : "DIVERGENCE"}
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
      </section>

      <section className={styles.invariants}>
        {[
          ["Turn", result.invariants.turnSync],
          ["Level", result.invariants.levelSync],
          ["Finish", result.invariants.finishSync],
          ["Target", result.invariants.targetSync],
          ["Command", result.invariants.commandSync],
        ].map(([name, pass]) => (
          <div className={`${styles.invariant} ${statusClass(Boolean(pass))}`} key={String(name)}>
            <span>{name}</span>
            <strong>{pass ? "PASS" : "FAIL"}</strong>
          </div>
        ))}
      </section>

      <section className={styles.clientGrid}>
        {result.clients.map(client => (
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
            </dl>
          </article>
        ))}
      </section>

      <section className={styles.notes}>
        <strong>Locked P4.1 semantics</strong>
        <p>Host has no Ready state. Bots are auto-ready. T38 Finish is shared; T39–T42 are room-wide rest; T43 resumes L6 for every participant regardless of Finish judgement.</p>
        <p>Player judgement may alter local score/combo/gauge/visibility later, but never the shared absolute turn, level, Finish cadence, target time, or canonical command.</p>
      </section>
    </main>
  );
}
