# MVP Entry Flow V1 — Character → Rooms → Waiting Room → Game

Owner decision (2026-10-09): **defer S2.5B Football Field, Classroom, Café** and prioritize
an end-to-end user journey on the existing app. No new project, no new stage,
no Stage Selector S3, and no gameplay architecture changes.

## Routes / smoke path

1. `/character/create`: choose an accepted runtime-ready character,
   customize name/appearance and tap **TẠO NHÂN VẬT**; save an existing
   `audition.characterCreationDraft.v1` localStorage draft.
2. Tap **TIẾP TỤC → SẢNH PHÒNG** to open `/rooms`.
   Device-stable `player-<UUID>` is created in localStorage (MVP-only).
3. `/rooms`: create an authoritative room with the profile's name and
   `characterAssetId`, choose a recent waiting room from the room list,
   or join by `mvp-*` code. Joining reserves an open slot through the
   existing room CAS API (revision conflict is retried).
4. `/rooms/[roomId]`: validate current local participant membership against
   canonical RoomState GET, then mount the existing WaitingRoomPanel with
   `initialRoom`, actual `participantId` and host/guest role.
5. Existing server-authoritative Ready → Host Start → preload →
   countdown/shared epoch → multiplayer gameplay remains unchanged.
   A guest who leaves goes back to `/rooms`; the Host back button
   returns to the browser but does not close/transfer the room.

## Data and security boundaries

- New `POST /api/multiplayer/room` action `create` creates unique
  server-assigned `mvp-<random>` rooms and validates Character Catalog
  runtime identity. The bootstrap RPC preserves atomic insert-if-absent.
- `GET /api/multiplayer/room?browse=1` returns public summaries only.
  The added `public.list_mvp_lobby_rooms()` SQL function is
  read-only, `SECURITY DEFINER SET search_path=''` with schema-qualified
  source, scoped EXECUTE grants and returns only room code/name, mode,
  player count, capacity and open slots. It restricts results to waiting
  `mvp-*` rooms updated in the last 72 hours (max 60 results). It does
  **not** expose historical QA rooms or raw participant snapshots.
  `public.lobby_rooms` table RLS and existing CAS RPCs remain intact.
- The migration `20261009020000_mvp_room_browser_public_summaries.sql`
  was applied to the existing Supabase project; no new database project
  or direct table grant to the browser.
- The old `/tools/lobby-qa` demo retains QA bootstrap and fixed
  fixture participants. Entry Flow never substitutes QA avatars for
  a removed member, nor auto-bootstraps a missing room.
- Local character draft and stable device participant ID are **not auth**.
  They can be edited by the user and cannot prevent identity spoofing.
  Persisted account/character ownership, login/session authorization,
  abuse rate limiting, host leave/close lifecycle and broader production
  room discovery must be designed in Phase 7/hardening before public launch.
- The MVP browser previews rooms, **not** a full social matchmaking service.

## Validation gates

- Vercel Next.js + TypeScript build and route manifest.
- Supabase schema/RPC/grants verified by read-only SQL.
- Playwright spec added for first-user prompt, creator→browser CTA
  and rejecting QA room identifiers. Do not report tests as executed
  until a runner actually executes them.
- Owner should test Safari portrait on two devices:
  Device A create/save character, create room, verify Host name/model.
  Device B create a different character, join via code/list, verify
  distinct avatar/name and slot in both clients, Ready/Start and
  matched gameplay. Test tab background/foreground and guest leave.
- No changes to WebAudio/global turn/gauge/Finish/sequenceCounts,
  CAS/Realtime protocol, preload epoch or Stage3D character architecture.

## Integration policy

Branch: `work/mvp-entry-room-flow-v1`.
Keep a draft PR against `development` until owner iPhone acceptance.
No merge of `development` or `main` without owner approval.


## 2026-10-09 — iPhone Safari/embedded-browser P5.5 handoff regression

Owner reproduced on **one iPhone with two distinct browser surfaces**:
- Guest's P5.5 gameplay page shows `SONG 0 ms`, `GLOBAL TURN T-5` and
  `RUNNING`, but no music progression.
- Host is in Waiting Room `STARTING / GO · SHARED EPOCH` and
  `AUDIO DECODED · scheduling shared epoch…`.
- Supabase canonical room was verified at revision 10 with both human
  participants Loaded, status Playing, and shared epoch
  `1791540332491` (same as owner's screenshots).

Root cause in **client lifecycle** with two distinct risks:
1. The audio scheduling `useEffect` depended on a reconstructed
   `matchStartSession` object. Updates to authoritative room revision
   re-created that object and could cancel the outstanding async
   scheduling callback, while its `gameplayScheduleAttemptRef` latch
   still blocked another attempt. This can strand the Host in the
   `AUDIO DECODED · scheduling…` state.
2. Mobile Safari/WKWebView can interrupt or suspend the AudioContext as
   the user swaps browser foreground; the shared RoomState can be
   `playing` even while a client WebAudio song clock has stopped. This
   is a separate iOS lifecycle limitation, not permission to restart,
   seek, or move the immutable shared epoch.

Fix scoped to `WaitingRoomPanel.tsx`:
- Audio scheduling dependencies now track primitive session key,
  immutable `startAtServerMs`, clock offset, participant identity, and
  audio readiness, **not** the reconstructed session object. Attempt
  latch is tied to exact session and epoch.
- AudioContext `statechange` is observed after audio activation.
  Suspended/interrupted contexts display a direct warning and an
  activation control where appropriate.
- `LiveMultiplayerGameplay.tsx` observes the *existing*
  authoritative song time for liveness diagnostics. After a sustained
  non-advancing song clock it displays `AUDIO STALLED`, not a false
  `RUNNING` claim. This diagnostic does not advance turns or mutate
  audio time.

Validation: Next.js/TypeScript and Vercel branch deployment. **Safari
runtime regression remains unverified** until owner repeats with two
separate foreground devices. Two apps/browsers alternating on the
same iPhone cannot certify simultaneous uninterrupted WebAudio.
No new epochs, offsets, seek, new turns, gauge changes, or gameplay
refactor. PR #18 remains Draft until owner iPhone acceptance.


## 2026-10-09 — Abandoned Waiting Room lifecycle fix

Owner observed “Phòng một nha” still advertised as **1/5 / waiting**
after both browser sessions had exited. Supabase read-only diagnosis confirmed
the canonical room was still at revision 3 with only Host persisted. This
happened because Host **Rời phòng** was disabled, the Entry header Back only
navigated, and `list_mvp_lobby_rooms()` treated any waiting snapshot updated
in the past **72 hours** as an open room.

**Scoped fix, no RoomState/gameplay rewrite:**

- **Host explicit exit:** Enable **Đóng phòng** for the actual
  `/rooms/[roomId]` Host when status is `waiting`. Require confirmation,
  then `POST /api/multiplayer/room {action:"close", expectedRevision,...}`.
  New `close_mvp_lobby_room` RPC deletes only that MVP row if its
  canonical host participant ID, revision and waiting status all match.
  Conflicts return the latest snapshot and the UI retries at most 3
  times; other room states (preloading/countdown/playing) cannot be
  deleted. Header Back uses the same close action for a waiting Host.
  Guest header Back now sends an actual leave CAS mutation before
  navigation (instead of leaving a stale occupied slot).
- **Tab/browser abandonment:** A visible Host sends a metadata-only
  heartbeat every 25 seconds and when the page returns to foreground.
  `touch_mvp_lobby_room` refreshes `updated_at` only if the MVP room
  is waiting and the canonical Host ID matches; it never edits the
  snapshot, revision, Ready state, Realtime protocol, preload, clock,
  WebAudio or gameplay. Room directory now advertises only waiting
  rooms touched in the **last 3 minutes** instead of 72 hours.
  An abandoned room is thus **hidden** without automatically deleting
  its underlying RoomState. Host can make it visible again by
  returning to the still-open waiting room.
- Room Browser refreshes on mount, on foreground return, and every
  30 seconds while open, so previously visible stale entries disappear.
- Original QA lobby fixture and no-auto-create Entry policy unchanged.
- DB migration applied to the existing Supabase project and checked:
  abandoned “Phòng một nha” is absent from directory, still persisted
  for historical inspection; non-existent room heartbeat returns false
  and close returns no rows. No user room was manually deleted.

**Known risks and acceptance:** Device participant ID remains a
non-authenticated MVP identity. Raw RoomState and Host ID are accessible
to clients under the existing contract; this action is not a secure
authorization boundary for public launch. Host tab termination is
best-effort via 3-minute directory expiry (not instantaneous server
deletion). When a Host closes a waiting room, other connected Guests
may require a refresh to see the 404 because no Realtime protocol
change was made. Owner must verify on iPhone:
create room, join guest, Guest leaves -> 1/5, Host taps Đóng phòng
or Back -> room disappears immediately; create second room and force
close Host tab -> it disappears from Room Browser within ~3 minutes.

PR #18 remains Draft; no merges without owner approval.


## 2026-10-09 — Owner direction: automatic Host succession in Waiting Room

**Newest owner rule supersedes the previous close-on-Host-exit behavior:**
When the Host voluntarily leaves a waiting room OR loses connection,
the **earliest-joined eligible human Guest** becomes Host. A room closes
only when the Host leaves voluntarily and there is no remaining Guest.
This is Waiting Room V1 only: no live match host reassignment after a
MatchManifest has been frozen.

**Authority / ordering / safety:**
- The canonical `RoomState.participants` list is append-on-join.
  Its array order (not a potentially reused slot number) determines
  which Guest entered first. A transfer drops old Host, promotes the
  selected Guest to slot 0, opens their prior slot, sets
  `hostParticipantId`, gives the new Host `readyState=not-applicable`
  and clears Ready for other human Guests. Room revision increments
  exactly once under a row lock with an expected-revision CAS gate.
- `handoff_mvp_room_host` is an additive waiting-only atomic
  Supabase RPC; it refuses preloading/countdown/playing and preserves
  all gameplay state/authority and the frozen shared epoch.
  If the last person leaves explicitly, the empty room is removed.
  The old destructive close RPC is revoked from anon/authenticated.
- `touch_mvp_room_member` records per-member server timestamps in
  the new isolated RLS table `mvp_room_member_lease`. Only the
  currently valid Host refreshes directory `updated_at`.
  Every visible Waiting Room participant heartbeats every 20 seconds;
  a live Guest checks the canonical room and asks the **server** to
  recover an absent Host (never electing a Host locally). The server
  requires Host heartbeat absent for 75 seconds, a 75-second room
  grace, and a fresh Guest lease. The earliest *live* Guest wins on
  disconnect. This prevents a single short iOS background pause
  from immediately stealing Host status.
- Explicit Host exit transfers immediately with a Realtime revision
  hint, then navigates back to the Room Browser. A Guest reconciles
  missed hints by periodic foreground RoomState GET. Client rebinds
  role from canonical data, not `initialSync.role`. Host crown,
  center slot, label and controls follow the promoted participant
  without changing character identity, rebuilding the 3D scene or
  restarting AnimationMixer. The promoted Host can use the normal
  Host START gate after remaining Guests Ready again.
- Room Browser discovery still excludes abandoned waiting rooms if no
  valid Host continues heartbeating. Automatic recovery occurs while
  at least one Guest remains active; there is no background cron
  and no arbitrary deletion of live matches.
- **Security limitation** remains: locally stored device IDs are
  not account-backed authorization. These RPCs inherit the MVP's
  participant-ID trust assumption and must be hardened for production
  authentication/anti-spoofing. Presence isn't considered a secure
  credential.
- No refactor to RoomState Ready/CAS/Reatime protocol, P5.4/5.5
  preload/shared epoch, WebAudio, gauge, Finish or global turns.

### Validation and owner acceptance

- Vercel TypeScript/Next.js build; Supabase migrations applied.
- A transaction-scoped DB QA fixture **actually passed**:
  first joined Guest at slot 2 beats later joined Guest at slot 1;
  promoted Host moved to slot 0, READY reset; stale revision
  rejected; second transfer worked; last Host left closed the
  room; fresh Host lease rejected takeover; expired Host lease
  transferred to live oldest Guest; fixtures cleaned.
- Owner iPhone runtime QA remains pending. Suggested run: 3 browser
  sessions / 2+ devices, join Guests B then C, check B wins if
  Host A presses Rời phòng. B should see Host crown/center/START,
  C should become NOT READY. Then repeat with A backgrounded or
  disconnected for at least ~75–95 seconds, both B/C foreground;
  verify no split-brain Host and normal Ready/Start gate.
- With no Guest: Host Rời phòng closes the room. With a frozen
  match: no role migration during preload or gameplay.
- PR #18 remains Draft; no merge without owner approval.


## 2026-10-09 — Manual Host Transfer — chosen Guest (owner requested)

Separate from automatic succession on Host leave/disconnect, the Host may
**tap any human Guest** in the existing Player sheet and choose **Chuyển Host**.
A confirmation dialog explains that the current Host will remain in the room
as a Guest and all human Guests must READY again. The UI is available only
to the **canonical current Host** of an unfrozen `WAITING` MVP Entry room.

Authority is server-owned and CAS-guarded:
- `POST /api/multiplayer/room {action:"transfer-host", expectedRevision,
  actorParticipantId, targetParticipantId}` validates a fresh canonical
  RoomState. New SQL `public.transfer_mvp_room_host` additionally locks the
  row and verifies revision, current Host, selected human Guest, waiting
  status and absence of MatchStart.
- One atomic revision advances by exactly one. The old Host becomes
  `guest/not-ready` occupying the selected Guest's previous slot;
  the chosen Guest becomes `host/not-applicable` at slot 0.
  Every other human Guest becomes NOT READY. The room stays open;
  no participant is dropped and neither avatar nor actor identity changes.
- Existing Realtime `room-revision` hints announce the winning
  authoritative snapshot. Both client role paths (live Realtime and
  foreground canonical refresh) update Host identity; the Waiting Room
  already reconciles ring/crown presentation **without recreating actors
  or restarting AnimationMixer**.
- Reject transfer to oneself, Bots, absent Guests, stale revisions,
  non-Host requesters and rooms that have started preloading.
  No local election, extra room clock or shared epoch mutation.
- Production security remains outstanding: the MVP's locally held
  participant ID cannot authenticate a Host to a public service.
  This is not ready for untrusted public traffic until account
  ownership/auth is enforced.

**Technical QA run:** Supabase transaction-scoped fixture PASS:
Host → chosen Guest at slot 2 while another Guest is at slot 1,
old Host retained in slot 2; all Guest READY reset; revision 7→8;
reverse Host transfer succeeded; invalid actor/target/self/stale CAS
rejected; preloading rejected; fixture cleaned.
Vercel TypeScript/build gates tracked by PR #18.
**Owner multi-client visual E2E: DEFERRED** as explicitly requested
in `docs/PROJECT_ROADMAP.md`. PR remains Draft and unmerged.


## 2026-10-09 — Multiplayer Audio Reliability Pass — WebAudio source timeline

Owner evidence on **one iPhone / two browsers**: the server persisted
canonical PLAYING / exact immutable shared epoch, but Guest's P5.5
screen could show `SONG 0 ms / AUDIO STALLED` while Host remained
at `AUDIO DECODED · scheduling shared epoch…`. This does **not**
prove two independent foreground devices fail; iOS backgrounding can
suspend JavaScript/AudioContext.

**Code-level failure modes confirmed by inspection (not device runtime proof):**

1. `WebAudioTransport.getCurrentTimeMs()` preferred
   `AudioContext.getOutputTimestamp().contextTime` when numerically
   finite. On Safari an output timestamp can be *valid but frozen at
   zero* while `AudioContext.currentTime` advances. WebAudio buffer
   sources are scheduled against `currentTime`, so song/gameplay time
   must be read from that same context timeline. There is no
   `Date.now` or `performance.now` gameplay-clock substitute.
2. The shared-start bridge awaited `AudioContext.resume()` with
   no bounded failure. On a suspended iOS page it could remain in a
   pending promise without a visible terminal error. Now shared
   scheduling has a 2-second resume timeout, reports errors and keeps
   the canonical start epoch unchanged.
3. The AudioContext clock may freeze during async resume while
   server/monotonic time passes the shared start epoch. A check against
   `context.currentTime` alone cannot detect this late start. The
   transport now also checks the immutable local monotonic deadline
   `plan.localStartMonotonicMs` immediately before source.start().
   If elapsed, it rejects; no replacement start, seek, or delayed
   room-wide rewind is issued.
4. The bridge starts `MultiplayerGameplayRuntime` **after** WebAudio
   source scheduling succeeds and resets the source on failure, so
   unscheduled clients do not falsely enter a RUNNING gameplay runtime.
5. The Waiting Room scheduling effect previously canceled an in-flight
   async attempt for same-session changes (NTP resample or user-gesture
   nonce) while retaining an attempt latch. It now tracks the exact
   `matchId/roomRevision/startRevision/participant/immutableEpoch`:
   same-epoch updates keep the attempt alive, true session changes
   or unmount cancel it. A new explicit audio activation gesture can
   retry a *failed* attempt, but not reissue the shared epoch.

**Regression tests added** in
`e2e/p55-web-audio-reliability.spec.ts` (five focused cases):
- frozen Safari output timestamp / progressing WebAudio context clock;
- suspended AudioContext with expired server deadline: no source;
- unresolved `resume()` ends with an explicit timeout error;
- two independently scheduled simulated players use the same server
  epoch and both local song clocks advance from AudioContext;
- late client returns LATE, without running gameplay or scheduling
  a replacement audio start.

**Validation actually run:** Vercel Next.js/TypeScript production build
PASS on this work branch. **The new Playwright tests were authored but
not executed** in this session (repository checkout/browser runner
unavailable). Physical **two-device foreground iPhone/desktop**
playback is still **PENDING**, and the older same-iPhone repro is
not considered resolved until verified. PR #18 remains Draft and
unmerged.

**Non-goals/unchanged:** WebAudio remains the authoritative game clock,
one turn remains four beats; MatchManifest, shared epoch, RoomState,
CAS, Finish, `sequenceCounts`, gauge, song length, stage and actor
lifetime are unchanged.


## 2026-10-10 — D01 P1 clock-sampling React lifecycle fix (Work QA follow-up)

Source: owner-supplied PR18 execution QA and its `PR18_QA_EVIDENCE.zip`.
Work reproduced a refresh regression with a real two-context local harness:
after PLAYING, a refreshed Guest remained at "Recovering shared server
clock…" while canonical RoomState preserved the issued epoch. A controlled
production-effect test found `syncStatus` changing from connecting to
connected during `sampleLobbyServerClock()`. The first React effect
cleaned up but kept `countdownAttemptRef` latched; the next render saw
the identical attempt and did not sample again, so `clockSyncState`
remained null and neither successful audio scheduling nor explicit
LATE handling could proceed.

**Focused fix:** `components/multiplayer/WaitingRoomPanel.tsx` now binds
clock sampling to the exact frozen match/startRevision/participant
identity (`matchStartSessionKey`) plus the all-loaded gate. Ordinary
`syncStatus`, `room.status` and `clockSyncState` changes do not clean
up an in-flight sample. The same async attempt checks
`roomRef.current` after await and only requests countdown while
canonical state is PRELOADING; if already COUNTDOWN/PLAYING it only
stores the offset. True match/participant switch or unmount releases
only the old attempt latch and ignores stale promise results.
Clock endpoint failures retry up to three times (short bounded
backoff); terminal errors clear the latch and appear in sync detail.

**Targeted regression artifact:** `e2e/p55-clock-recovery-effect.spec.ts`
extracts the actual production effect via TypeScript and runs
controlled hook lifecycle scenarios: (1) connecting→connected and
clock-state rerender while the first sample is pending, (2) first
sampling request fails, second succeeds, (3) session identity changes
during sampling and the stale promise cannot overwrite the new
offset or leave the old latch. This specifically covers the gap that
the original five WebAudio transport tests did not cover.

**Validation actually executed here:** Three direct JavaScript
isolated reproductions of the extracted production effect PASS
(using controlled promises and React dependency/cleanup simulation).
Vercel Next.js/TypeScript build PASS. The committed Playwright
file and the Work QA local two-browser refresh E2E have **not yet
been executed end-to-end** on this new commit; rerun in ChatGPT Work
against the new verified HEAD. Owner physical iPhone QA remains
deferred. Do not mark D01 fixed on iOS until both QA rerun and
device checks pass.

No changes to RoomState, CAS, Supabase Realtime protocol, shared
epoch, WebAudio authority, `sequenceCounts`, gauge, Finish or global
turn scheduling. PR #18 stays OPEN / Draft, unmerged.


## 2026-10-10 — D01-R terminal clock recovery (follow-up to Work QA)

Second independent Work QA proved the original D01 status-change race
is fixed and ordinary Guest refresh in PLAYING now reaches explicit
LATE with the original immutable server epoch. Work found **D01-R P1**:
after three failed `sampleLobbyServerClock()` rounds, the ref latch was
cleared but `useEffect` had unchanged dependencies. Realtime reconnect,
foreground and audio activation did not trigger a new server-clock
sample. `syncDetail` was subsequently overwritten by audio preparation,
leaving the user at CLOCK SYNC / AUDIO DECODED without recovery controls.

**Focused implementation** in `WaitingRoomPanel.tsx`:
- Terminal sampling errors are stored in a dedicated
  `clockSyncFailure: { sessionKey, message }` state. Only the exact
  active `matchStartSessionKey` may display the failure; unrelated
  audio/preload status updates cannot erase it.
- The Waiting Room's existing preload banner shows a persistent
  `CLOCK SYNC FAILED` alert and **THỬ ĐỒNG BỘ LẠI** button in
  PRELOADING, COUNTDOWN or PLAYING. Audio status also identifies the
  clock failure rather than claiming to be stuck scheduling.
- The button works only after the old attempt releases its latch,
  while the same all-loaded human participant/session remains active.
  A synchronous click guard prevents double-tap retries. It clears
  the error and increments explicit `clockRetryNonce`, the only new
  dependency of the D01 sampling effect. Realtime status, current
  RoomState revision and audio activation remain excluded.
- Sample success clears the clock failure and fills the ordinary
  server-clock estimate. If the canonical epoch is already past,
  the unchanged WebAudio scheduling bridge returns **LATE**; no new
  epoch/audio seek/fallback clock is introduced.
- A separate countdown-CAS failure is **not** mislabeled as a
  recoverable sampling failure. The independent QA report identified
  potential countdown-CAS retry reachability as a source-review
  hypothesis; it is not modified in this focused D01-R patch.

**Regression coverage:** `e2e/p55-clock-recovery-effect.spec.ts`
now includes the production-extracted retry handler and tests for
terminal three-attempt failure, durable session-scoped alert state,
no implicit retry from Realtime updates, double-tap suppression,
explicit same-session retry, and stale-error isolation after a
match change. Earlier D01 promise-race tests remain.

**Validation:** Two direct isolated JavaScript executions of the exact
production `useEffect` and retry handler PASS for terminal recovery
and old-match isolation; Next.js/TypeScript Vercel build PASS.
The newly committed Playwright regression file and full two-client
refresh/terminal-fault E2E have **NOT** been re-run in the Work
browser harness on this new commit. This remains
**D01-R IMPLEMENTED / AUTOMATED QA PENDING / OWNER DEVICE QA PENDING**.
No claim of iPhone Safari hardware verification.

PR #18 remains OPEN / Draft; no merge to development.


## 2026-10-10 — Multiplayer Stage3D/HUD presentation integration (PR #18)

After independently verified D01/D01-R automated recovery QA, the owner
approved integrating the existing multiplayer WebAudio/GameplayRuntime
consumer into the actual portrait 3D presentation.

**Integration (presentation-only):**
- `WaitingRoomPanel` still owns the same PRELOADING → shared epoch →
  COUNTDOWN → WebAudio schedule handoff. Only after a successful schedule
  and `gameplayActive` does it mount `LiveMultiplayerGameplay`.
  The existing `MultiplayerGameplayRuntime` remains the sole consumer
  of command/judgement/score and the WebAudio transport remains the only
  gameplay clock.
- `LiveMultiplayerGameplay` renders existing `Stage3D` behind a
  portrait HUD with frozen roster labels, local score/combo, global
  level/turn, deterministic command/reverse/Finish presentation,
  existing `AuditionGauge` driven by exact BPM/spaceStartMs and
  WebAudio song-time, touch SPACE/D-pad, and existing judgement artwork.
  No opponent scores are fabricated. Existing P5.5 song/epoch/global
  turn diagnostics remain as QA data-testid hooks.
- `Stage3D` has an optional `characterAssetId` override.
  Multiplayer resolves the **local human avatar** through
  `MatchManifest.participants[].avatar` → migration compatibility
  `avatarCharacterAssetId` → Character Catalog. No participant name
  or gender heuristic; no untrusted localStorage Character Creation
  draft for this character. Solo Stage3D usage without the prop is
  unchanged. It consumes the frozen Waiting Room stage ID and
  existing Stage Catalog/runtime fallback.
- Runtime local judgement callback feeds the published choreography
  presentation event with frozen seed, authoritative `atSongTimeMs`
  and absoluteTurn. Stage3D's CharacterActor continues to use the
  WebAudio `getSongTimeMs` callback. The event never mutates
  gameplay/clock/RoomState.
- The existing WebAudio stall alert, AUDIO END semantics and immutable
  shared-epoch diagnostic markers remain. UI RAF only samples runtime
  snapshots and *never* advances time itself.

**Explicit scope limitation:** this first integration renders the
*local player's* 3D character. Other frozen participants are shown in
the roster, but networked remote judgement / dance animation poses and
a true synchronized five-actor gameplay formation are **NOT**
implemented. Do not imply real opponent scores or remote animations.
That requires a separately approved protocol/presentation task.

**Validation:** Vercel build and TypeScript checked for the focused
presentation changes. Browser stage-rendering, real character asset/
animation, mobile GPU performance, iOS two-device audio and Supabase
staging multiplayer E2E remain **NOT RUN in this implementation pass**.
Keep PR #18 OPEN / Draft; do not merge or imply owner visual acceptance.

Locked invariants untouched: RoomState authority/CAS, Supabase Realtime,
ready/host gate, preload/epoch handoff, WebAudio scheduling, calibrated
gauge parameters, Finish/AUDIO END, sequenceCounts and global rhythm
turn timeline.


## 2026-10-10 — Host-only START (single human in a multiplayer room)

Owner explicitly requested that a connected Host can START when they are
the only participant in the Waiting Room; no Bot or second client is
required. **One targeted change** to `canStartRoom()` removes the
`opponent-required` guard. Preconditions remain: canonical room is
WAITING, the song is selected, and the occupied Host exists and is
connected. If any non-Host participant is present, existing Guest READY
gating remains unchanged (Bots are always Ready). Empty/open/closed
slots do not require readiness.

The **same** authoritative `freezeLobbyMatch` →
`beginLobbyPreload` → Host LOADED ACK → `allClientsLoaded`
(one frozen participant) → `beginLobbyCountdown` →
immutable server epoch → WebAudio scheduling → PLAYING path is used.
No new solo gameplay runtime, replacement countdown, fake opponent,
timeline extension or clock fallback.

Regression updates:
- `e2e/multiplayer-domain.spec.ts`: host-only gate succeeds; no-song
  and disconnected-host gates still reject; Host has no READY action;
  Guest READY and Bot behavior remain covered.
- `e2e/lobby-all-clients-loaded.spec.ts`: host-only canonical room,
  frozen one-participant manifest, Host-only loading/LOADED, one
  immutable countdown epoch and PLAYING all pass through the existing
  application domain functions; duplicate countdown is rejected.

**Validation actually run:** Vercel production build and TypeScript
PASS for this branch. The new Playwright tests and physical iPhone
Host-only START/audio/Stage3D gameplay were **NOT executed** in this
implementation environment (GitHub checkout/package runner unavailable).
Independent Work QA and owner iPhone smoke test remain pending.
No change to WebAudio authority, RoomState/CAS protocol, gauge,
Finish or global turn budget. PR #18 remains Draft/unmerged.


## 2026-10-10 — Multiplayer HUD correction after owner iPhone screenshot

The owner verified **Host-only START works** on the deployed iPhone
preview, but rejected the new multiplayer-only HUD: oversized
CLUB AUDITION/MY SCORE cards, the bespoke command tray, and custom
SPACE/D-pad controls did **not** match the existing accepted gameplay
presentation.

**Correction on PR #18**:
- Retire the bespoke multiplayer HUD CSS-module presentation.
  `LiveMultiplayerGameplay` now mounts Stage3D inside the same
  `audition-page → audition-stage → audition-hud` layout and
  `hud-song`, `level-panel`, `combo-panel`, `command-zone`,
  `command-strip`, `mobile-controls` classes as the existing
  `components/GameShell.tsx` gameplay HUD.
- Reuse the exact accepted portrait control artwork paths:
  `/ui/controls/portrait-space-from-sketch.png` and
  `/ui/controls/portrait-dpad-from-sketch.png`. The shared
  `GameCommandTokenVisual` component contains the exact solo
  command SVG previously in GameShell; GameShell itself now imports
  that same component, with no visual logic change.
- Continue using `AuditionGauge` with locked parameters and
  WebAudio-derived currentTimeMs, and existing `JudgementLabel`.
  Use the frozen local player identity/score only: avoid copying
  fake opponent scores/leaderboard numbers from solo QA placeholders.
- Keep all gameplay command/Finish, judgement, score, event and
  audio clock authority with the **unchanged**
  `MultiplayerGameplayRuntime`/`WebAudioTransport`.
  P5.5 matchId/epoch/songTime/globalTurn data-testid diagnostics
  remain for independent regression checks, but are hidden from
  the ordinary portrait HUD. Stage3D retains the frozen
  MatchManifest Character Catalog asset.
- Stabilize the keyboard listener for 60fps HUD re-renders. Add
  E2E selectors verifying both client HUDs reuse the GameShell
  class hierarchy, 3D stage and owner-approved control images.

**Validation scope:** Next.js/Vercel TypeScript build is the only
automatic execution available to this implementation session.
Browser E2E and visual/physical iPhone comparison of the corrected
layout remain **PENDING**. Do not claim visual acceptance until
the owner reviews a new screenshot. Host-only START must remain
untouched and PR #18 must remain OPEN/Draft.


## 2026-10-10 — RC01: concurrent five-Human preload CAS recovery

Work real-client QA on HEAD `abac9c4bd78adc2d624d93b69dea75bcb59d87c0`
reproduced a P1 failure with five independent Human clients (local PGlite SQL/CAS +
Realtime shim). Concurrent `preload-loading`/`loaded` updates exhausted the
three-attempt client CAS loop. The client incorrectly sent `preload-failed`
after **metadata contention**, leaving the room in PRELOADING (3 LOADED,
2 FAILED in recorded traces) and without an epoch.

Focused RC01 correction on `work/mvp-entry-room-flow-v1`:

- `multiplayer/preload-cas-retry.ts` retries only the frozen-session
  metadata mutation against the latest canonical RoomState revision.
  Conflict responses are inspected as conflicts even if HTTP status is 200.
  Retries use bounded backoff/jitter, up to 24 attempts with a 20-second
  metadata retry budget. Cancellation and changed match/start identity
  prevent stale ACK mutations.
- `WaitingRoomPanel` keeps successfully loaded resource readiness in a
  session-scoped ref and resends the same `loaded` ACK without fetching assets
  again after a retryable CAS/network failure.
- Only an actual frozen-content preload exception can report
  `preload-failed`. A persistent metadata failure instead shows a separate
  `PRELOAD ACK RETRY` message and explicit `THỬ GỬI LOADED LẠI` action.
  The attempt latch is released on terminal contention so the explicit
  retry is possible. No automatic new match, extra epoch, or bypass of
  `ALL CLIENTS LOADED`.
- `e2e/preload-cas-retry.spec.ts` adds a five-Human canonical-state
  concurrent CAS regression, a terminal contention/manual retry case, and
  stale-session/cancellation guards.

Unchanged: RoomState/server CAS authority, Realtime protocol, Guest READY
and Host-only START, frozen MatchManifest, shared epoch, WebAudio/gameplay
clock, gauge, Finish, Stage3D and accepted portrait HUD.

**Validation status:** Next.js/TypeScript through Vercel CI at the final HEAD
is the minimum implementation gate. Newly added Playwright tests and the
five-browser local PGlite/Realtime-harness reproduction still require actual
execution; neither Vercel build success nor source inspection is a five-Human
E2E PASS. Follow with Work rerun on real independent browser contexts,
then staging Supabase verification. Keep PR #18 OPEN/Draft.
