# Animation Flow V2.2.4 — Continuous 8-Beat Choreography

Repository: ToanFreelance/audition-mobile-mvp
Branch: work/animation-flow-qa-v2 · PR #19 Draft · isolated /tools/animation-flow-qa-v2.
Baseline: V2.2.3 fee6cddbd0676506a80c1a3cd92b7e33a7a410ba.

## Owner iPhone acceptance and defect

- L1–L5: SPACE-immediate dance transition accepted; do not redesign.
- L6–L9: a successful NORMAL judgement is commonly followed by one HIDDEN global turn, so the next eligible SPACE can be 8 musical beats later. The V2.2.3 ordinary pool contains 15/16 phrases shorter than 8 beats. On clip end V2.2.3 changed to a short standing idle, making dancing stop in the HIDDEN interval.
- Flare Finish/dismount/brief idle improved and accepted as visual direction; leave untouched.

## Correction

`SessionChoreography` tracks the successful judgement level (supplied from the existing authoritative `MultiplayerGameplayJudgementEvent.level`). For L6–L9 only, when an ordinary source phrase reaches its **pre-end window**, the visual consumer:
1. Advances the existing `SourceFlowEngine` to the precise authored beat, even after a sparse RAF.
2. Chooses a compatible normal dance continuation using an **independent seeded shuffle bag** (so real SPACE shuffle state and gameplay selections are unchanged).
3. Starts a bounded crossfade (max 0.35 beat) to that continuation **before** the outgoing one-shot reaches its final held pose.
4. Repeats as needed until a real successful SPACE event arrives, which immediately replaces the visual continuation; never fabricate a judgement, turn or replacement turn.
5. Maintains root XZ continuity and 1.35 root-radius/facing limits via existing `placement` and `request(... immediateGameplay=true)` logic.

The bridge is a choreography **presentation segment**, not a new gameplay command. `SessionChoreography.selections` still records only events derived from the canonical runtime. Telemetry `continuityEvents` labels `kind: dance-bridge`, exact visual beat, originating source, successor and rejection reason.

If no compatible dance fits, the fallback remains the existing living standing idle and reports `no-spatial-facing-compatible-bridge` (not silently considered dance PASS); do **not** force a teleport, bypass heading constraints or rewind the timeline. Another compatible dance may be tried on later valid SPACE.

Outside L6–L9, existing V2.2.3 behavior remains. Flare, Finish, REST, published male/female meshes, Character Catalog, RoomState, WebAudio and all production gameplay are unchanged.

## Regression

Review on 110/120/160/200 BPM with 0.15/0.35/1 beat fades; deterministic and sparse RAF. Acceptance is not just "no standing pose after 8 beats": the bridge starts **before** the final source frame, must not add a gameplay judgement and must not consume real SPACE seeded choreography order. Root radius <=1.35, entry dXZ≈0, stage anchor invariant, stage heading/upper-body continuity preserved. Check real iPhone for visible repeated dance, contact foot sliding and frame hitch at internal bridge.

Locked shared timeline: 4 beats/global turn, first Finish absolute 38, shared REST 39–42, L6 resumes absolute 43, further Finish 62/86/110. Do not add "extra beats" to a level or Finish.

## QA provenance

The V2.2.3 baseline included new e2e tests that had **not** been executed independently in the previous review, even though Vercel type-check/build was green. In V2.2.4 adjust the test callback to pass the existing judgement level and add checks for sustained L6–L9 dance, no synthetic SPACE, seed+fade matrices and sparse catch-up. Report which test and build commands actually run and distinguish those from pending visual acceptance. Do not claim iPhone PASS on Canvas 2D.
