# Phase 5 / P5.1 — Waiting Room Foundation

Branch: `work/lobby`.

P5.1 begins Phase 5 as a presentation/domain-binding slice on top of the accepted P4 multiplayer architecture. It does not replace the P4 room model, shared start clock, preload gate, or multiplayer gameplay runtime.

## Locked room semantics

- maximum six slots;
- slots remain `OPEN`, `CLOSED`, or `OCCUPIED`;
- host has no Ready state;
- human guests may toggle `NOT_READY` / `READY` only while waiting;
- bots remain auto-ready;
- Start is enabled only through `canStartRoom()`;
- changing song or mode resets non-host human Ready while bots remain Ready;
- Ready remains consent to the current room configuration; P4.4 Loaded remains a separate technical preflight state.

## P5.1 waiting-room shell

`/tools/lobby-qa` renders a portrait waiting-room shell bound directly to `RoomState`:

- room title/id/mode/occupancy;
- occupied participant lineup from avatar snapshots;
- six slot states;
- host/guest role simulation;
- guest Ready toggle;
- host open/close empty slot control;
- host song/mode QA controls;
- Start gate driven by the existing domain rule only.

## Dedicated waiting-room 3D stage

The waiting room uses a new `WaitingRoomStage3D` rather than modifying gameplay `Stage3D`.

- direct Three.js remains the renderer;
- canonical Phase 3 humanoid GLB is loaded once per stage mount and skeleton-cloned for occupied participants;
- participant identity includes the frozen avatar `characterId`, leaving room for later visual variants without replacing room-domain identity;
- a lightweight local fallback actor is used if the canonical model fails to load;
- the waiting-room stage is intentionally static in P5.1 and has **no continuous RAF loop**;
- it renders on model load and resize only, minimizing idle GPU/battery cost on iPhone;
- renderer/scene resources and ResizeObserver are cleaned up on unmount.

Waiting-room visuals are presentation-only. They own no WebAudio clock, beat clock, global turn, Ready rule, or start authority.

## Non-goals

- no matchmaking or public room directory;
- no persistence/database room service;
- no quick-join algorithm;
- no gameplay HUD redesign;
- no waiting-room dance/idle animation loop yet;
- no Phase 6 game modes;
- no changes to WebAudio, global turns, Finish, gauge, or P4.5 multiplayer gameplay authority.
