# P5.7 — Seamless Match Start / Background Match Warmup

Owner approved 2026-11-24. Dedicated branch work/p5-7-match-warmup-v1, based on accepted M3 normal START d3579ff788b441735ab1df93736c39f670736e29. No development/main merge.

## P5.7A — Speculative asset warmup

Previously all gameplay assets were warmed after START. In verified WAITING, prepare only selected song, stage, roster appearance and relevant animation assets, at low concurrency. Existing persistent cache keys are reused for versioned stage, animation and M3 files; audio and legacy assets use the same HTTP force-cache path as frozen preload. No decoded audio or second WebGL scene. Procedural venues need no GLB prefetch. Versioned animation bytes are warmed without parsing the bundle. Cache availability is advisory only.

Debounce content changes, deduplicate by resource identity, ignore READY/presence/revision/slot/display-name changes. Abort on leave/START/hidden/offline/superseding content; a shared M3 request already in progress may finish, but no stale generation publishes progress or starts further assets. New generations serialize behind old ones. Compact local ASSETS hint beside existing SYNC label; never call it match LOADED. START does not wait for warmup, and failure or cache eviction is handled by existing authoritative frozen PRELOADING.

The final fresh metadata fetch, manifest identity, complete preload, LOADED acknowledgments, RoomState CAS, shared epoch, WebAudio scheduler, 4.5s lead time, global timeline and scene/actor lifetime stay unchanged. No performance claim without benchmark. Browser HTTP cache may revalidate/redownload; P5.7A primarily shifts network work earlier.

Next: P5.7B audio pre-decode and provisional clock sampling with freshness/context checks, then P5.7C measured handoff optimization, P5.7D UI polish as needed, P5.7E 1/2/5-client benchmark and real iPhone acceptance. No Dance V2 work.

## P5.7B — Local decoded audio and provisional NTP (2026-11-24)

P5.7A's first CI failed on a test assigning disconnected to bot participants (bot type only permits connected); corrected the fixture without changing RoomState. Asset warmup now warms the same persistent audio URL cache used by WebAudioTransport. AudioContext remains activated by a real click/READY/START only; host may warm on first room interaction, not automatically play audio. One speculative transport per selected song/context, serialize non-abortable decode, clear when song/room/context changes or unmount. Frozen music metadata and chart are still fetched and verified before transfer into the match. Matching transport moves once, mismatches/failures use existing prepare path. No AudioBufferSourceNode is started by warmup.

Sample the server while verified, online, visible and waiting. At all-loaded, reuse a provisional offset only within 20 seconds of sample start, same scope, stable wall/monotonic age, >=3 selected samples, selected RTT <=150ms and offset spread <=50ms, AND a fresh confirming probe (<=150ms RTT and <=25ms offset difference). Invalidate on visibility/network/page lifecycle; explicit clock retry bypasses warm reuse. On any failure, original full sampling and retries remain. No change to epoch CAS, default lead, WebAudio clock or scheduling. Added reuse checkpoints for later benchmark; no measured speedup claim yet.

## P5.7C/D — Fast handoff and compact readiness feedback

A/B baseline 5b8674b passed TypeScript, ESLint and 78 deterministic lobby tests; Vercel READY. START now fetches fresh music and animation metadata concurrently. Frozen audio preparation and LOADED preloading single-flight identical in-flight metadata verification, never a completed stale metadata request. Frozen music preload consumes the full response using the same audio Cache Storage key as warmup/transport; no shortcut around frozen identity, chart or LOADED validation. Existing audio metadata fingerprints are not byte checksums; URL cache versioning remains the existing transport contract. No lead-time reduction, no additional scene. Settings distinguishes local asset and decoded-audio readiness from the player's READY and match LOADED. Warm hints disappear while hidden/offline/starting; no global readiness claims.

## P5.7E — Measurement

Record local Host START and Guest first frozen-match observation; mark the actual curtain hidden only after the existing stage-ready/WebAudio gates and CSS fade. Expose data-launch-origin and data-launch-elapsed-ms in live DOM, and an optional perf=1 display. Existing C3 local diagnostic trace retains 40 checkpoints, including frozen observation, clock ready, audio ready, stage ready and curtain hidden. Never compare independent monotonic clocks across browsers. Host latency is START-to-visible; Guest latency is first observed match-to-visible (excludes earlier host freeze/network time). No gameplay timing changes. Physical iPhone acceptance remains required.

### Real browser benchmark runner

`e2e/p57-real-benchmark.spec.ts` uses 1/2/5 independent real M3 guest contexts via entry flow, Room API/CAS/Realtime, no QA query, no mock audio. Explicit P57_REAL_BENCH=1 only; workflow restricted to the P5.7 branch, no merge. Record local warmup statuses, actual curtain hidden latency, epoch, song-time progression and screenshots even on failure. A 75s bounded handoff is a correctness ceiling, not a latency performance target; no claim of 5–7s until measured. Chromium DPR=1 on a software runner is not iPhone or five independent devices. The scenario starts fresh contexts and waits for bounded warmup; it does not measure cold immediate-START baseline. Compare with an equivalent cold/warm device recording later. Guest profiles are not email-login QA. No mandatory countdown DOM observation.

## P5.7F — iPhone-led entry and START critical path (2026-11-24)

Owner recording showed approximately 18s from create to room presentation, and 15s from START to visible Gameplay. These are video-derived estimates, not function timings. A new song reached ASSETS/audio ready before START. Prior Work software-renderer measurements remain separate; five-client QA is not accepted. Do not assume CPU retarget caching is the principal iPhone bottleneck.

F.1: run entry identity resolution and existing no-store room read concurrently; validate canonical snapshot, room identity, human membership and saved avatar before showing the initial room. Mount the accepted Waiting Room presentation from that validated initial WAITING snapshot; the canonicalVerified/Realtime gate for START and background warmup is unchanged. Parallelize initial Realtime-config and canonical room reads, retain post-subscription canonical refresh and recovery. No extra scene or actor recreation for READY/presence.

F.2: parallel fresh metadata and canonical GET at START, bound to the exact clicked room revision. Reject changed local or server revision; remove redundant second GET only because server route still reads the authoritative current row, checks expectedRevision, validates Host/Ready/manifest and performs atomic compare-and-swap. Conflicts are adopted/recovered, never replay START. No server protocol, mutation semantics, frozen content validation or lead-time change.

F.3/F.4: add entry, individual START reads, fresh-probe/full-sampling, countdown CAS checkpoints and stage environment/actor/first-ready-frame duration data attributes. No relaxation of NTP freshness/RTT, no shared epoch adjustment, no animation retarget/cache rewrite. Measure real-device effect before further optimization. Existing iPhone/5-human acceptance remains open.
