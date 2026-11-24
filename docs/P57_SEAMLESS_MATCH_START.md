# P5.7 — Seamless Match Start / Background Match Warmup

Owner approved 2026-11-24. Dedicated branch work/p5-7-match-warmup-v1, based on accepted M3 normal START d3579ff788b441735ab1df93736c39f670736e29. No development/main merge.

## P5.7A — Speculative asset warmup

Previously all gameplay assets were warmed after START. In verified WAITING, prepare only selected song, stage, roster appearance and relevant animation assets, at low concurrency. Existing persistent cache keys are reused for versioned stage, animation and M3 files; audio and legacy assets use the same HTTP force-cache path as frozen preload. No decoded audio or second WebGL scene. Procedural venues need no GLB prefetch. Versioned animation bytes are warmed without parsing the bundle. Cache availability is advisory only.

Debounce content changes, deduplicate by resource identity, ignore READY/presence/revision/slot/display-name changes. Abort on leave/START/hidden/offline/superseding content; a shared M3 request already in progress may finish, but no stale generation publishes progress or starts further assets. New generations serialize behind old ones. Compact local ASSETS hint beside existing SYNC label; never call it match LOADED. START does not wait for warmup, and failure or cache eviction is handled by existing authoritative frozen PRELOADING.

The final fresh metadata fetch, manifest identity, complete preload, LOADED acknowledgments, RoomState CAS, shared epoch, WebAudio scheduler, 4.5s lead time, global timeline and scene/actor lifetime stay unchanged. No performance claim without benchmark. Browser HTTP cache may revalidate/redownload; P5.7A primarily shifts network work earlier.

Next: P5.7B audio pre-decode and provisional clock sampling with freshness/context checks, then P5.7C measured handoff optimization, P5.7D UI polish as needed, P5.7E 1/2/5-client benchmark and real iPhone acceptance. No Dance V2 work.
