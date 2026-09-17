# Phase 4 / P4.2 — Shared Start Clock Mapping

Status: implementation milestone on `work/multiplayer-clock`.

## Goal

Map one immutable room/server start epoch onto each client's local monotonic clock and AudioContext scheduling timeline without introducing a competing gameplay scheduler.

P4.2 does not add real networking transport yet. Clock samples and latency are simulated deterministically in `/tools/multiplayer-qa`.

## Locked clock model

- The room owns one `startAtServerMs` epoch for the match.
- Each client estimates `serverClockOffsetMs` from NTP-style four-timestamp samples.
- The client maps `startAtServerMs` to a local monotonic timestamp, then to an `AudioContext` start time.
- Once playback starts, WebAudio remains the authoritative gameplay song clock inside that client.
- The room/server epoch is a synchronization reference, not a per-turn scheduler.
- The server never emits `Turn 38 now`, `Turn 39 now`, etc. Absolute turns remain derived from song time.
- Network latency, jitter, a missed input, a local penalty, or a bot outcome must never move `startAtServerMs` or create/repeat global turns.

## Offset estimation

P4.2 uses the standard four timestamps:

1. client send monotonic time;
2. server receive time;
3. server send time;
4. client receive monotonic time.

Per-sample network RTT removes server processing time. Offset estimation selects the lowest-RTT samples and uses the median offset, reducing sensitivity to a high-latency outlier.

## Audio scheduling

For an estimated server offset:

`localStartMonotonicMs = startAtServerMs - estimatedServerOffsetMs`

The future local monotonic start is converted to:

`audioContextStartTimeSec = audioContext.currentTime + leadTimeMs / 1000`

A late client does not shift the room epoch. P4.2 reports that client as late; P4.4 will own the room-start decision for late/not-loaded clients.

## Drift observation

P4.2 compares local WebAudio song position with the room reference derived from the shared epoch. Positive drift means local audio is ahead; negative drift means it is behind.

The current QA bands are diagnostic only:

- `<= 20 ms`: good;
- `> 20 ms and <= 50 ms`: warning;
- `> 50 ms`: fail.

These are not active correction thresholds and are not a final production SLA. P4.2 never seeks, pauses, stretches, rewinds, or reschedules live audio to hide drift.

## Deterministic QA

`/tools/multiplayer-qa` now supports deterministic simulated RTT profiles:

- 0 ms;
- 50 ms;
- 100 ms;
- 200 ms.

The fixture retains one human host plus five bots. Each participant has a different simulated local/server clock offset, but all receive the same match start epoch.

The QA harness displays:

- global turn / level / Finish / command invariants;
- shared start epoch;
- simulated RTT profile;
- per-client offset-estimation error;
- per-client expected song drift;
- audio scheduling status.

## P4.2 acceptance

- NTP-style offset math is deterministic and test-covered;
- server processing time is removed from RTT;
- high-RTT outliers do not control the selected offset estimate;
- all six simulated clients map the same immutable room epoch;
- 0/50/100/200 ms simulated RTT scenarios schedule before the start epoch;
- current deterministic scenarios remain within the P4.2 20 ms good-drift QA band;
- late scheduling is surfaced explicitly and never shifts the room epoch;
- P4.1 turn/Finish/command determinism remains unchanged;
- no production Solo Easy scheduler, gauge, Stage3D, character, or Phase 2 HUD file is modified.

## Deferred

- P4.3 real room transport / clock-sample exchange;
- P4.4 pre-game loading acknowledgements and all-clients-loaded gate;
- P4.5 real multiplayer gameplay integration;
- reconnect and active-playback correction/hardening remain later work unless blocking.
