# M3 Main Flow Step 2 — Creator → Room Browser → Waiting Room

Date: 2026-11-22
Branch: `work/m3-main-flow-integration-v1`
Baseline: V1.7.2 owner-accepted `64272d1`.

## Scope

- Enable `lobbyReady=true` only for `m3-drophunter` and `m3-neurohacker`; keep `runtimeReady=false`.
- Saved creator look (`hairStyle`, `hairColor`, `skinTone`, `m3Outfit.top/bottom`) is sent by Room Browser on host CREATE and guest JOIN, validated against the Character Catalog + matching source wardrobe and stored as `avatar.m3Appearance` in canonical RoomState.
- Existing local player ID and legacy `default-female` / `default-male` fallback are retained; invalid M3 appearance rejects without silent substitution.
- A creator-confirmed M3 can continue to Room Browser using the same-height CTA, avoiding a preview-height jump.
- WaitingRoomStage3D assembles M3 from the same source assets and one-skinned-skeleton architecture, clones a separate actor per participant, and reuses approved V15 Mixamo runtime with owner-approved Standing Greeting 2 V14.
- Mixamo data loads only when M3 is present. Original `public/m3-qa/standing_greeting_2_v14.b64` is served as the validated compact source package; no new commercial-asset claim.
- Stage keeps the already-accepted renderer, camera, stage artwork, and C1/C4 behavior. M3 face/mouth receive the same local normal shading as Creator preset F; global stage tone mapping is unchanged.
- `participantId + characterAssetId + validated M3 look` determines actor identity. READY, connection, name and load status changes never recreate an actor, rig or mixer. Genuine appearance/identity changes replace only the relevant actor.
- Mixamo playback includes the V15 anti-lockstep independent phase selector for duplicate automatically started gestures, curated Dwarf exclusions and V14 Standing Greeting. The original QA-specific import/review controls are not ported to production.
- Both client canonical START eligibility and server start-preload mutation block any non-`runtimeReady` participant. Do NOT freeze/play a M3 MatchManifest yet.

## Out of scope

Do not merge V15, P4.6A/#23, or Animation Flow V2/#19. No gameplay M3 animation controller, stage ensemble, Shop/Inventory, gameplay clock, RoomState CAS protocol change, Supabase Realtime protocol change or START gate removal.

## Validation

Focused Vercel TypeScript + optimized production build, asset / route HTTP 200, source diff and bundled pure-data Playwright test (`e2e/m3-lobby-appearance.spec.ts`). **A passing build is not a five-human runtime PASS**. 
Physical iPhone Safari owner QA required before Step 2 acceptance:

1. Save female / male M3 creator look; Continue to Room Browser; create room and verify chosen model+outfit+skin+hair in Waiting Room.
2. On second device join with another M3 look; verify remote appearance matches selection, reconnect/reload preserves profile.
3. Verify one to five independent actors animate; reused clips have different phases, Standing Greeting V14 plays naturally, no rejected Dwarf Idle.
4. Toggle READY / NOT READY, connection state and host succession without actor/mixer restart or duplicate load; verify existing C1/C4 room remains unchanged.
5. Host START stays unavailable for any M3 room; direct server START mutation must reject. No PRELOADING/PLAYING.
6. Inspect iPhone Safari WebGL shader/errors, face F visual consistency, outfit clipping, mobile FPS/memory and no staged false-ready on failed M3 load.

## Remaining risks

- Owner physical iPhone QA / multi-client Supabase test not yet confirmed.
- Mixamo V15 source retargeting/crossfade may have thermal and mobile CPU costs at five actors; do not assert five-person performance PASS based on build.
- M3 creator Studio uses Neutral tone mapping/exposure while Waiting Room keeps accepted stage-wide ACES lighting; local F shader matches but full appearance may require a later owner-guided calibration.
- MatchManifest currently does not preserve M3 appearance fully, and gameplay `CharacterActor` does not assemble VRM rigs. Both remain Step 3 blockers; `runtimeReady` MUST stay false.
