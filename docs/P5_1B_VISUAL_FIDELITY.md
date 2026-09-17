# P5.1b — Waiting Room Visual Fidelity Pass

Source of truth: Phase 5 portrait waiting-room sketch (`54FD2C86-CA5A-496F-AA8C-AF6940B66A52.jpeg`).

## Goal

Bring the P5.1 waiting-room presentation materially closer to the sketch without changing the accepted room-domain contract or Phase 4 synchronization architecture.

## Locked functional behavior

- `RoomState` remains the waiting-room source of truth.
- Host has no Ready state.
- Human guests use Ready / Not Ready.
- Bots remain auto-ready.
- Start remains gated only through `canStartRoom()`.
- Host song/mode changes reset non-host human Ready.
- Waiting-room presentation owns no gameplay clock.
- P4.4/P4.5 start/gameplay architecture is untouched.

## Visual contract

- Full-bleed portrait nightclub/stage composition rather than nested QA cards.
- Header overlays the room scene with room title, ID, mode and occupancy.
- The stage shows two participants per view with left/right paging for additional occupants.
- Character names, levels, host crown and Ready state are visually attached to their stage position.
- Six compact room slots use avatar-style circular states for occupied/open/closed slots.
- Song card and bottom room actions match the compact sketch hierarchy.
- QA-only controls are hidden behind the settings control and are not part of the default screenshot composition.
- No continuous waiting-room RAF; rendering remains event/resize driven.

## Non-goals

- No Phase 5 realtime room sync yet.
- No lobby discovery/create/join flow yet.
- No new cosmetics/inventory system.
- No gameplay HUD changes.
- No gauge, Finish, scheduler or WebAudio changes.
