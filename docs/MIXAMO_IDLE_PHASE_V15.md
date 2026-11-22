# M3 Waiting Room Mixamo QA — V15 Independent Idle Phases

## Owner symptom (2026-11-22)

In a five-person waiting room at least two actors sometimes start the same
animation at the same frame and then move perfectly in lockstep. Different
actors **may reuse** the same motion asset, but should play it at different
times rather than look like duplicated choreography.

## Root cause

The existing per-participant shuffle-bag already checks `occupiedProfiles()`
and avoids a duplicate whenever the shortlist allows it. But the safe
stationary pool contains fewer base clips than there are actors, so collisions
are expected. The real visual bug is in action startup: each
`AnimationAction.reset().play()` used `time = 0`, and all Waiting Room
mixers update in the same render tick. Two actors using the same clip at t=0
remain perfectly synchronized.

## V15 focused fix

- Retain the catalog, existing animations and random shuffle-bag policy.
- Feed the current `currentGesture` and `poseTime` of **other** actors through
  a read-only callback from the existing stage actor registry. This does not
  create new actors or mutate RoomState/Supabase/Ready/gameplay.
- In `createMixamoLobbyIdle`, assign an independent phase **only when the same
  clip is already active**: at the first automatic startup, on automatic
  transitions, and on an automatically replayed identical clip.
- The phase chooser scans safe early-to-middle playback slots, requires
  a minimum time difference from peers and caps seeking before the clip's
  ending/crossfade region. No changes to per-clip rotation, hip or foot tracks.
- Explicit manual clip selection and imported one-clip source review ALWAYS
  start from frame 0. The QA button to play Greeting on all five actors
  intentionally stays synchronized to permit frame-accurate comparison.
- Actor mixers, source asset loaders, touch UI, shared stages, multiplayer
  protocols and animation timing authority are unchanged.
- No extra mixers, per-frame skeleton mutation, animation speed multiplier
  or global clock coupling.

## Validation

Focused pure-data Playwright tests:
- 5 actors using one 5.1s clip get pairwise-distinct phase offsets.
- Different gestures remain at phase 0.
- Late joiners use actual peer phase.
- Four actors on a shorter clip remain staggered.
- Invalid inputs fail safely.

Visual acceptance on iPhone: load the existing five-person
`/tools/lobby-qa-sketch` V14 URL; compare the `id` and `time` fields in
the motion QA panel. Matching IDs should not show matching time values,
except after the owner explicitly requests `Phát Greeting cả 5`.
Test the natural random state after several transitions. Manual mode is a
different explicit synchronization test.

## Scope

Work branch `work/m3-waiting-room-integration-v1`; no merge.
The V14 accepted Standing Greeting source is unchanged.
