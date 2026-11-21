# M3 Mixamo Clip-by-Clip Owner Review Demo (after V9)

## Why
The owner disagrees with a subset of the V9 exclusion list. **Do not assume a measured joint-proxy sum maps to visible skating.** Give the owner a direct, one-actor, source-named visual review of *every* available native M3 Mixamo animation. All V9 curation decisions remain provisional pending this review.

## Scope and links

Reuse isolated QA Waiting Room sketch route; no new project, gameplay or backend protocol changes. Use:
- Female, 9 clips: `/tools/lobby-qa-sketch?m3=female&mixamo=1&clipReview=1&contactV4=1&pelvisFix=1&sideStepV6=1&contactV7=1&contactV8=1`
- Male, 8 clips: same with `m3=male`
- V8 A/B disabled: same with `contactV8=0`

`clipReview=1` overrides V9 `stationaryOnly=1`, showing full unfiltered `MIXAMO_GROUPS` including V9-excluded Bored, Dwarf Idle 2, Sad Idle, Waving and manual Catwalk Twist (female). The display names come from the actual catalog keys. It does **not** invent clips missing in one rig.

## Exact owner controls
- **Back / Next** move in catalog order, wrapping at both ends.
- Each button performs `runtime.select(id)`, which in clip-review mode stops prior actions and restarts the chosen clip at time 0 on the existing mixer. No shuffle, fade or additional actor.
- Each clip plays **once** and holds its last pose. Use Replay to restart. This intentionally avoids attributing end-to-start **loop seam** jumps to the animation's grounded foot motion.
- Full list dropdown, clip name and index, elapsed/total time, front/side and 0.25x/1x controls, female/male links.
- Optional marking per gender in session: `Chân ổn` or `Trượt chân` and `Copy đánh giá` (plain text for user to paste). Marks are local React state and reset on page navigation; copy the marks before changing gender.
- Collapsible control panel, mobile portrait first.

## Controls and invariants
All changes are QA-only behind `clipReview=1` on `/tools/lobby-qa-sketch`. The underlying Character Catalog, RoomState/CAS, Supabase Realtime, Waiting Room actual render, Ready/Start, preload protocol, shared start epoch, WebAudio and rhythm timeline are untouched. Existing V9 Stationary Only remains opt-in and unchanged for separate tests. No deletion of source FBX/embedded samples, no reauthoring or arbitrary reconciling of the list.

The stage publishes `data-m3-clip-review`, `data-m3-active-gestures`, `data-m3-review-clip-durations` and existing actor/mixer identities, so the tool can prove isolated playback. Multi-actor V9 mode is intentionally not the clip review view: choose female or male to view one real M3 actor without mixed poses.

## Validation
TypeScript, Next.js build, Chromium native M3 female/male full-catalog Prev/Next/Replay and out-of-range wrap, no accidental shuffle/crossfade/actor replacement, and client hydration. Owner iPhone is final visual quality gate. Do NOT claim clip-specific skating solely from V7/V8 aggregate contact travel.
