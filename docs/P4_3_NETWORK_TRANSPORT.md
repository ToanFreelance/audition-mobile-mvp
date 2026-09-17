# Phase 4 / P4.3 — Real Networking Transport

Status: implementation milestone on `work/multiplayer-clock`.

## Goal

Add a real room transport for Phase 4 without moving gameplay clock authority out of WebAudio.

P4.3 uses:

- Supabase Realtime Broadcast for room messages;
- Supabase Realtime Presence for connected participant presence;
- a same-origin Vercel/Next server-clock endpoint for NTP-style clock samples;
- the existing P4.2 offset estimator to map shared server epochs onto each client's local monotonic / AudioContext timeline.

No Postgres multiplayer table is created in P4.3.

## Locked authority model

Realtime is a transport, not a gameplay scheduler.

Allowed over room transport:

- room snapshot / room revision metadata;
- participant presence;
- frozen match manifest metadata;
- one shared `startAtServerMs` match-start epoch;
- QA ping/pong messages.

Forbidden as an authoritative networking pattern:

- `Turn 38 now` / per-turn server pushes;
- per-beat server pushes;
- remote player judgement changing room time;
- bot-owned timers changing room time;
- network latency pausing, repeating or replacing global turns.

Once playback starts, local WebAudio remains the authoritative gameplay/song clock. `absoluteTurn`, level, Finish cadence and canonical commands continue to derive deterministically from song time and match content.

## Transport contract

`multiplayer/transport.ts` defines the provider-independent room transport boundary.

Current payload kinds:

- `room-snapshot`;
- `room-revision`;
- `match-manifest`;
- `match-start-epoch`;
- QA-only `qa-ping` / `qa-pong`.

Every envelope includes:

- transport protocol version;
- room id;
- sender participant id;
- message id;
- typed payload.

## Supabase Realtime adapter

`multiplayer/supabase-realtime-transport.ts` implements the transport using the native Supabase Realtime WebSocket protocol.

P4.3 deliberately does not add `@supabase/supabase-js`; this avoids a new runtime dependency for the small Broadcast/Presence surface currently required.

The adapter owns only:

- WebSocket connect/join/leave;
- channel heartbeat;
- Broadcast send/receive with acknowledgement;
- Presence track/state/diff;
- connected/disconnected/error status.

It does not own gameplay time or turn progression.

Reconnect automation is not claimed complete in P4.3. Unexpected closure is surfaced as `disconnected`; full reconnect/resume robustness remains later hardening work.

## Real server clock exchange

`POST /api/multiplayer/clock` returns:

- server receive epoch milliseconds;
- server send epoch milliseconds.

The browser records monotonic send/receive timestamps around the request and feeds the resulting four timestamps into the P4.2 estimator.

Clock samples only estimate the mapping between server epoch and local monotonic time. They never directly advance gameplay.

## One-iPhone real transport QA

`/tools/multiplayer-qa` can open two actual Realtime WebSocket clients from one Safari page:

- QA Host;
- QA Guest.

The real-network check validates:

1. both clients join one ephemeral room;
2. Presence converges to 2/2;
3. Host Broadcast ping reaches Guest and Guest pong reaches Host;
4. room revision metadata is transported unchanged;
5. one exact shared-start epoch is transported unchanged;
6. both logical clients sample the real server-clock endpoint;
7. Guest maps the received epoch to a future local schedule;
8. no gameplay turn is sent over the network.

This is a real transport check but is not equivalent to two physical devices. Two-device gameplay validation remains P4.5 when hardware is available.

## Security scope

P4.3 uses ephemeral **public** Realtime QA channels and a Supabase publishable key.

This is acceptable only for the current internal architecture/transport milestone. It is not a claim of authenticated/private production-room security.

Before public multiplayer release, room authorization, participant identity, hostile-event validation and private-channel/RLS policy must be addressed in the appropriate account/security hardening scope.

Never expose the service-role key to the browser.

## P4.3 acceptance

- Vercel production build passes;
- TypeScript passes;
- room transport abstraction remains separate from gameplay runtime;
- native Realtime adapter implements Broadcast + Presence + heartbeat;
- clock sample endpoint is no-store and uses server epoch timestamps;
- QA route can execute two real Realtime clients from one iPhone;
- real room messages never carry authoritative `absoluteTurn` / per-beat scheduling;
- no production Solo Easy scheduler, gauge, Stage3D, character or accepted Phase 2 HUD file is changed;
- no Phase 5 lobby/waiting-room UI is implemented.

## Deferred

- P4.4 all-clients-loaded gate and authoritative room start protocol;
- P4.5 actual multiplayer gameplay integration with Human + Bot / Human + Human;
- reconnect/resume hardening;
- authenticated/private room authorization;
- Phase 5 create/join room and 3D waiting-room presentation.
