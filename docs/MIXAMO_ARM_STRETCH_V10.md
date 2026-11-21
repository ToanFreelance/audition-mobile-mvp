# M3 Waiting Room V10 — Arm Stretching and Underarm Cloth Clearance

Owner review, 21 November 2026:

- `Cheering` is too exuberant for the Waiting Room. **Do not put Cheering into any automatic/real 5-person idle library.**
- `Arm Stretching` has good idle energy and feet appear more stable, but on iPhone the separately skinned M3 shirt/sleeve visibly intersects in the armpit when the arm reaches across the torso (female and male review videos).
- Both `Dwarf Idle` and `Dwarf Idle 2` were previously rejected on iPhone and must remain completely excluded from auto playback.
- Owner requests actual mixed-gender five-actor random/crossfade runtime test, not a single-actor JSON import/review.

## Implementation

All changes are QA-only, opt-in with `armStretchV10=1`, and reuse `/tools/lobby-qa-sketch`; do not affect real production Waiting Room or Ready/Host Start/global rhythm timing.

Data: owner supplied `Arm Stretching.fbx` and generated M3 source world-delta JSON. The V10 static asset `public/m3-qa/arm_stretching_source.json` contains **only Arm Stretching** (267 frames, 30fps, 52 source bones, source SHA256 1996cc8a480604ef72e12bca46f322128f1edc978e10c02785bbd76630d6d24f). No Cheering included; do not edit authored FBX curves. Source pack is fetched only when the QA URL has `armStretchV10=1`. One fetch is reused by all 5 actors, and each character independently retargets against its actual skin bind pose (never currently displayed pose). Same catalog/Character Catalog rig resolution, same M3 actor, same mixer and shuffle-bag.

Playlist: in V10, add `arm-stretching` to the **base** of either the filtered Stationary Only playlist or the normal auto playlist; keep all existing owner-excluded Dwarf Idles out. To avoid unapproved steps and increase diagnosis fidelity, the recommended V10 URL enables `stationaryOnly=1`, V7 + V8 for **existing** clips, and disables V6 Bored. Arm Stretching remains source authored (V7/V8 contact modifiers do not rewrite its hip or leg keys). V8 retains a read-only contact profile for matching transitions.

Armpit: M3 shirts are independent SkinnedMesh garments. V10 clones the top garment geometry **per actor** and adds a low-amplitude local morph only along the lower sleeve/axilla regions selected using arm-bone weights and skeleton shoulder height. Small controlled sleeve ease is normal/lateral, not arm-bone IK: maximum theoretical offset <= 16mm. Morph influence follows Arm Stretching's `AnimationAction.getEffectiveWeight()`, fades with the existing crossfade and is zero for all other gestures. Restores and disposes each clone when the actor runtime is disposed. The original body, clothing source, accepted Wardrobe, and other animation keyframes are not modified.

QA preview:
`/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&contactV7=1&contactV8=1&stationaryOnly=1&sideStepV6=0&armStretchV10=1`

The UI permits **Phát Arm Stretch cả 5** (manually demonstrate the garment on 5 real actors) and **Về random** (resume existing shuffle-bag). QA data attributes include `data-m3-arm-stretch-v10` and `data-m3-arm-sleeves-v10` with garment/vertex count, amplitude and live morph blend. Actor/mixer identity must not change. No footage or static image proves complete absence of clipping: owner iPhone video is primary visual acceptance.

Validation: TypeScript, Next build, real Chromium five-person Playwright (catalog exclusion + source duration + all 5 actors, consistent mixer/scene IDs, arm morph activation/return, screen evidence), original non-opt-in baseline unchanged. Review scope remains work branch; no merge.
