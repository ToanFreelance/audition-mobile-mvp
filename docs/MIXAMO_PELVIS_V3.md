# Mixamo Waiting Room — V3 pelvis-only motion experiment

## Owner visual finding

Foot Lock V2 prevented visible shoe sliding at the cost of unnatural knee/leg posture. It is **rejected as the default**. The fix must preserve the selected Mixamo full-body motion and stop inventing constraint-driven leg poses. V3 is available **only** in the isolated Waiting Room QA route; the production Waiting Room and gameplay timeline are unchanged.

## Source-grounded decision

The owner supplied the original animation-only FBX files. Reviewing their FK ankle trajectories on the source rig and two true M3 VRM rest skeletons shows:

- `Bored` has substantial **common horizontal displacement** of the two ankle trajectories during near-floor frames. Both feet can be improved by a small shared X/Z hip correction, without modifying limb rotations.
- `Sad Idle` already has an explicitly animated **right-foot lift and stepping gesture** (about 40 cm of ankle height above its initial pose during the motion). Replacing this with an invented step would not be faithful to the source; preserve its authored step. If the landing slips, it needs separate time/sole tracking and source-level animation work.
- `Breathing Idle 2`, `Dwarf Idle`, `Warrior Idle`, `Pointing`, `Waving`, and `Blow A Kiss` have low near-floor lateral foot travel in the source. Do not alter their data. The crossfade requires separate visual sign-off.

## V3 behavior

On `/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&pelvisFix=1`, the player uses the same original authoring and random bags, but adjusts only the sampled `hips.position.x/z` track for **Bored** prior to constructing its Three.js `AnimationClip`. The 30 FPS correction was **baked** offline on *each M3 rig*; it is intentionally limited to 2.4 cm, low-pass smoothed and tapered to **zero at both clip boundaries**. Because this is a clip track (not an after-mixer frame override), Three.js crossfades it normally. No global actor transform, joint quaternions, IK/foot lock, arm poses or timing changes are introduced.

`pelvisFix=1` is mutually exclusive with `footLock=1`. The latter remains only for historical A/B and must not be enabled in production.

The default query `mixamo=1` intentionally uses **unmodified** Mixamo clips. If the user rejects the pelvis correction, remove only the V3 selection; no files need be rolled back.

## Source analysis (reconstructed native M3 skeleton FK)

| Rig | Ankle | Near-floor path before | Predicted after V3 | Reduction |
|---|---|---:|---:|---:|
| Drophunter | Left | 32.42 cm | 19.85 cm | 38.8% |
| Drophunter | Right | 34.86 cm | 18.49 cm | 47.0% |
| Neurohacker | Left | 33.21 cm | 20.69 cm | 37.7% |
| Neurohacker | Right | 36.06 cm | 19.21 cm | 46.7% |

These numbers are cumulative ankle motion **while near the floor** as estimated by the same source FK method before and after baking correction; some motion may still be intentional. They are **not** an assertion of zero shoe-sole slide or accepted human motion. Max correction 2.4 cm; frame step under 3 mm. `Sad Idle` is not changed. No additional artificial step gesture is committed because it would require modifying leg articulation and a proper animator-reviewed contact phase, risking the same distortion rejected in V2.

## Reproduction / QA

Tool: `scripts/m3-idle/bake_mixamo_pelvis_qa.py`, with `scripts/m3-idle/mixamo_retarget_pilot.py`; requires original owner-supplied `Bored.fbx` and two separate VRM rig bodies. **Do not upload source FBX/VRM to public GitHub.** Output is a small two-rig correction curve in `components/character/mixamo-pelvis-stabilizer.ts`.

Run `e2e/mixamo-pelvis-v3.spec.ts` in the focused M3 Waiting Room CI: bounded curve, zero endpoints, original hip Y unchanged, other clips untouched, and real M3 mesh browser smoke. Inspect real animation on iPhone in front/side cameras, especially `Bored` during 0–10.67 seconds and crossfade to emotes.

### Remaining risks

Actual sneaker contact geometry (heel/toe), perceived balance, mirrored movement and crossfade feet require the owner's iPhone visual approval. This pilot is NOT merged or enabled by default.