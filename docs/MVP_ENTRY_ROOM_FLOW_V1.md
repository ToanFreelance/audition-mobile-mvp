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
