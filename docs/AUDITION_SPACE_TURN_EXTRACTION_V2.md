# Audition Space-Turn Motion Extraction V2

Branch: `work/character-rig-animation-v1`

Base integration state: P5.6 already accepted on `development`.

## Correction to the previous capture model

The owner clarified a critical gameplay fact:

> each Space press starts a different dance animation.

Therefore the previous long-form mocap assumption is deprecated.

A 15–20 second gameplay window can contain several unrelated animation assets. It must **not** be treated as one continuous choreography clip and later split heuristically.

The extraction unit is now:

```
Space N
  ↓
one bounded Audition animation
  ↓
Space N+1
```

This is a source-content rule only. It does not change gameplay architecture.

## Locked runtime invariants

- WebAudio remains the authoritative clock.
- One global turn remains four beats.
- The global timeline never pauses/repeats/extends for animation.
- Semantic gameplay IDs remain `dance-01 ... dance-08` plus `finish-special`.
- Multiple captured motions may become presentation variants under one semantic ID.
- Finish remains presentation-only; only AUDIO END ends the game.

## Source priority

### Primary — Spain / Moonlight

YouTube id: `aKq04-9_oT0`

Why it is now the preferred source:

- dancers remain in stable stage positions;
- camera is comparatively stable;
- full-body silhouettes are easier to track;
- the supplied local source is high frame rate;
- Space/turn cadence is visually regular;
- around the strongest inspected region, consecutive boundaries are approximately 1.7 seconds apart, close to four beats at ~144 BPM.

Initial high-confidence candidate boundary series:

```
184.5
186.2
187.9
189.6
191.3
193.0
194.7
```

This produces six atomic ~1.7 second motion candidates.

These timestamps are **candidate extraction boundaries**, not publication-grade frame locks. Before an animation enters the library, each boundary must be refined against the local high-quality source to the exact Space/judgement transition frame.

### Secondary — Boss / 4K-8K group source

YouTube id: `XZvLqpfM1eo`

Use after the Moonlight pipeline proves clean on 2–3 atomic turns. This source contains much more choreography variety, but more players and a much longer capture make it a second-stage catalog source.

## Extraction workflow

1. Detect or mark Space boundaries.
2. Create exactly one video clip between consecutive Space events.
3. Keep a minimal frame guard only to avoid UI-transition contamination.
4. Send **one atomic clip** to DeepMotion.
5. Use the corrected Meshy custom-character bind-pose asset (v2), not local cross-skeleton retarget v1/v2.
6. Review the direct DeepMotion custom-character result.
7. Reject clips with bad limb tracking, foot skating, body inversion, or severe occlusion.
8. Assign accepted clips to one of `dance-01 ... dance-08` only after viewing the motion.
9. Keep source timestamp + Space index + confidence in the catalog.
10. Publish only after owner iPhone QA.

## Clip generation helper

A focused helper is included:

```bash
node scripts/extract-audition-space-clips.mjs \
  --source "/path/to/Moonlight.mp4" \
  --manifest docs/motion-sources/moonlight-space-turns-v1.json \
  --out ./tmp/moonlight-space-turns \
  --execute
```

Without `--execute`, the helper prints the ffmpeg commands only.

The helper deliberately does **not** infer semantic dance IDs. Choreography classification comes after motion/deformation QA.

## DeepMotion cost strategy

Do not spend credits on another 20-second multi-animation capture.

Start with 2–3 atomic Moonlight turns (~1.7s each). If direct custom-character output is clean, expand to the remaining Moonlight turns, then catalog the Boss source.

This reduces solver ambiguity and avoids paying for unusable long capture intervals.
