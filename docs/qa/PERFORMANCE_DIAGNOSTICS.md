# Opt-in multiplayer performance diagnostics

## Enable and export

1. Create/join a room normally. On the actual `/rooms/<roomId>` URL append
   `?perf=1` (or `&perf=1` if a query already exists) and reload before READY/START.
   Entry CREATE/JOIN navigation does not automatically preserve this query.
2. Complete genuine READY, START, preload and shared countdown. The compact
   overlay appears in `LiveMultiplayerGameplay` and observes its real `Stage3D`.
3. Keep the device in the foreground; warm accepted assets/scene before taking
   a bounded sample. Click **Xuất JSON** to download `audition-performance.json`.
4. Remove `perf=1` and reload to disable. Activation is latched for the mounted
   Waiting Room; query edits without reload do not toggle a running match.

This is a read-only QA observer. It does not adjust DPR, select a GPU, change
assets, schedule audio, modify input judgements or mutate RoomState.

## Data contract and limits

- One 2-second aggregation timer; no extra render RAF. Latest 120 summaries,
  200 events per type and at most 4096 frame intervals per window are retained.
- WebGL backend/context metadata is cached once per renderer initialization.
  Frame/aggregation loops never call `getParameter`, `getExtension` or
  `getContextAttributes`. Counters come from JavaScript-owned `renderer.info`.
- CSS canvas and physical buffer dimensions, requested/effective DPR,
  frame-interval mean/p50/p95/p99/threshold counts, submission cadence FPS,
  geometries/textures/programs/draw calls/triangles and renderer/actor lifecycle
  counts are included. Stage callback duration is CPU submission/presentation
  work, not GPU execution time. GPU memory in bytes is unavailable.
- Long Tasks API availability is explicit; Safari may not expose it. It does
  not supply JavaScript stack attribution. HUD commit observations count passive
  effects on the gameplay view; production React commit duration is unavailable
  and exported as `null`. No continuous React Profiler or console logging.
- Native context identity/state/currentTime progress and WebAudio song time are
  sampled independently of frame intervals. Wall time is used only to describe
  observation intervals, never to advance gameplay. Short stalls between
  samples can be missed. No acoustic/output latency is measured.
- SPACE includes browser event timestamp, handler entry, dispatch-delay estimate,
  duration and pre-handler song/target observations. Runtime judgement callbacks
  supply the exact song time/target/delta when a judgement exists. A callback
  emitted by `advance()` before a declined SPACE remains separately labeled;
  it is not fabricated into a SPACE result. Null results are legitimate.
- Metadata/export contain no room/participant identifiers, credentials or network
  response bodies. Browser/GPU identification can be privacy-masked by the engine.
- Overlay updates are isolated from scene creation. Its export button stops
  keyboard bubbling and the remaining overlay does not intercept pointer controls.
  Observers, timer, subscriptions and renderer/audio references are released on
  teardown. The observer never disposes application-owned rendering/audio objects.

## Qualification

Cloud SwiftShader results do not establish desktop hardware GPU performance or
physical iPhone/Android performance. Use this mode on real foreground devices,
record OS/browser/backend and actual buffer dimensions, and compare the same
accepted stage/character/content. Hardware DPR A/B is a separate isolated QA
experiment; no production DPR override or automatic quality adjustment is added.

V14 implementation validation and limitations are recorded in
`PR18_V14_PERFORMANCE_DIAGNOSTICS_REPORT.md` and
`PR18_V14_PERFORMANCE_DIAGNOSTICS_EVIDENCE.zip`. Final five-Human integration and
physical AUD01 acceptance remain independent gates.
