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
