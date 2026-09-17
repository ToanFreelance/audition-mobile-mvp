# Phase 4 / P4.1 — Multiplayer Domain Foundation

Status: implementation milestone on `work/multiplayer-clock`.

## Goal

Prove that one shared match timeline can drive one human participant and up to five deterministic bots without allowing player outcome state to own or modify global turns.

P4.1 is intentionally additive. It does not add real-time transport, Supabase room networking, the Phase 5 lobby UI, or the 3D waiting room.

## Locked architecture

- WebAudio remains the authoritative song clock inside a gameplay client.
- P4.2 will map a shared room/server start epoch onto the local WebAudio clock; P4.1 does not introduce a competing clock.
- One global turn remains four beats.
- `sequenceCounts[level]` remains the total global-turn budget.
- Player judgement may affect score/combo/gauge/local command visibility, but never the shared absolute turn, level, Finish cadence, target time, or canonical command for that turn.
- Finish remains a Level 9 special command and is not a game-end condition.
- Non-final Finish uses one room-wide four-turn rest for every outcome: T38 Finish → T39–T42 shared rest → T43 L6 sequence index 4.
- The deterministic Aloha cadence remains Finish turns 38, 62, 86, 110.

## Waiting-room contract carried forward to Phase 5

- Maximum six occupied participant slots.
- Slot states are OPEN / CLOSED / OCCUPIED.
- The host has no Ready state and owns Start Game.
- Human guests use NOT_READY / READY.
- Bots are auto-ready.
- Start is enabled only when there is at least one non-host participant and every occupied non-host participant is ready.
- OPEN and CLOSED empty slots do not block Start.
- Changing song or mode resets human guest Ready state; bots remain ready.
- READY means player consent in the waiting room. LOADED is a separate pre-game technical state.
- Participants carry avatar snapshots from the domain layer so the Phase 5 3D social waiting room can display character/cosmetic identity without replacing the participant model.

## P4.1 deterministic command contract

Solo Easy currently owns a sequential seeded PRNG for its established single-player runtime. P4.1 does not modify that accepted production path.

For multiplayer, canonical command generation is stateless per global turn:

`match seed + absolute turn + purpose -> turn seed -> command`

This guarantees that consuming, hiding, missing, reconnecting, or rendering a different number of commands on one participant cannot advance a shared PRNG stream and change another participant's canonical command.

## QA bots

P4.1 provides deterministic PERFECT, MISS, MIXED, and PASSIVE policies. Bots never own a timer or gameplay clock. A bot only decides the synthetic outcome for the current shared turn.

## QA harness

`/tools/multiplayer-qa` is designed for owner testing on one physical iPhone. It displays one human host plus five bots, shared turn/level/Finish/target/command-hash invariants, player-local visibility/judgement, and presets around the locked Finish cadence.

The harness is a deterministic simulation tool, not the Phase 5 game UI.

## P4.1 acceptance

- room/slot/host/ready rules covered by deterministic tests;
- immutable MatchManifest snapshot;
- avatar-bearing participant contract;
- stateless per-turn multiplayer command derivation;
- one human + five bots supported;
- mixed Finish outcomes preserve T39–T42 shared rest and T43 L6 resume;
- 100-turn simulation reports zero global divergence;
- no production Solo Easy, gauge, WebAudio transport, Stage3D, character, or Phase 2 HUD files modified.

## Deferred

- P4.2 shared start epoch / local WebAudio mapping;
- P4.3 real networking transport;
- P4.4 pre-game preload acknowledgements and all-clients-loaded gate;
- P4.5 multiplayer gameplay integration;
- Phase 5 create-room, room-list, 3D waiting room, swipe camera zones and loading-banner presentation;
- reconnect/security/telemetry/performance hardening remains later roadmap work unless it becomes blocking.
