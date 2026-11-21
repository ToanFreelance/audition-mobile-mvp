# M3 Waiting Room V11 — Standing Greeting 2 (owner FBX, QA integration)

Owner input: `Video-test(20261121-094122).mp4` (54.27s, 512×1106, 30fps)
and `Standing Greeting 2.fbx` (binary FBX v7700, 65 Mixamo models).

## Source analysis

- One `mixamo.com` animation stack: 0–5.1s inclusive, 154 frames at 30 Hz.
- Source SHA-256: `8ab3d94aaa0b6bfaf3616d54ad392cf46b502e328b5eabec40838b8db2b4c276`.
- Original source FBX PreRotation, local Euler rotations, PostRotation inverse, and full source hierarchy were evaluated into world-space delta quaternions. Hips translation normalized against first-frame hip-to-foot height.
- Measured original source displacement vs first pose: left foot 1.2cm, right foot 0.9cm, left toe 1.3cm, right toe 1.0cm horizontal maximum. Hips shifts up to 2.1cm forward. Those numbers are *source only*, not proof of planted M3 feet during crossfade.
- Arm motion is substantial (source world-delta upper arm up to about 84° left/102° right, right forearm up to 145°); inspect armpit clipping, wrist crossing and body collisions visually on both M3 wardrobes.

## Mobile source package

`public/m3-qa/standing_greeting_2_v11.bin.gz` (5,815 bytes) is an opt-in compact source curve package. It stores authored 30Hz adaptive world-delta tracks for body, arms, legs and proximal fingers, plus sampled hip movement. Quaternion reconstruction is slerped back to 154 frames (30fps) and fed to the **existing** M3 source retargeter using the target skin bind pose.

This is a **mobile-compressed animation candidate**: the intermediate/distal finger deltas inherit their proximal joint delta instead of independent full-resolution FBX curves. Body/arm/leg adaptive angular tolerance is 0.75°, proximal finger tolerance is 3°. Do not represent it as a byte-for-byte or fully articulated FBX export. Original FBX stays out of Git.

## Isolation and playback

V11 is opt-in through `greetingV11=1` on the preexisting `/tools/lobby-qa-sketch` route. V10 `armStretchV10=1` can coexist, and the same five catalog-driven M3 actors, mixers, shuffle-bag and crossfades are reused. No actor/realtime/Ready/gameplay changes.

5-actor mobile QA:

`/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&contactV7=1&contactV8=1&stationaryOnly=1&sideStepV6=0&armStretchV10=1&greetingV11=1`

The manual `Phát Greeting cả 5` and `Phát Arm Stretch cả 5` buttons isolate the clips on actual stage actors; `Về random V11` resumes shuffle. The owner's rejected Cheering, Dwarf Idle and Dwarf Idle 2 stay excluded. V7/V8 do not rewrite owner-authored greeting/arm animation curves; only read-only V8 contact profiles are collected.

## Video review limitations

The owner's recorded 54.27s iPhone video shows five independently playing actors with arms gesturing. At 512px-wide image scale, the underarm seam is not resolved well enough to certify or fully refute shirt/skin clipping. The V10 seam morph remains an experimental local garment ease; if clipping persists, rebind the shirt's skin weights or edit garment geometry rather than increase global morph or bend the arm unnaturally.

Validation target: TypeScript/Next build, targeted Playwright V10+V11, unchanged actor/mixer IDs, source file loading, excluded catalog, both manual selections and random transitions. Visual acceptance remains owner iPhone testing. No merge.

## V12 correction — Owner iPhone video 2026-11-21 12:34

Source inspection of `Standing Greeting 2.fbx` (65 Mixamo Model nodes, 154 frames at 30fps) identified the visual regression. The FBX has BOTH arms close to horizontal at the first and last frame. Its LEFT arm stays almost fully extended sideways through the greeting; only its RIGHT arm animates into the active wave (roughly 1.5–3.3s). The V11 retarget faithfully copied the stationary T-pose arm into the Waiting Room, producing the obvious rigid extended-arm gesture captured in the owner's 16.74s iPhone recording.

A geometry/sleeve morph or foot-lock is NOT the proper fix for this. V12 corrects the *clip authoring* boundary in `mixamo-greeting-idle-pose-v12.ts` during actor initialization, before the action is registered. It composes the left arm / fingers from the existing catalog-matched `Breathing Idle 2` authored motion and blends the greeting's right-arm joints from neutral to source and back (source fully weighted 1.65–3.65 seconds). This keeps the source greeting's active movement, hips, feet, body/head tracks and M3 actor/mixer lifecycle unchanged. It does not override animation bones on every runtime frame. Both source assets remain untouched.

An isolated Playwright/Three.js synthetic pose test asserts the corrected non-gesturing arm stays neutral, the waving arm is full source at 2s and neutral at 0/5.1s, and hip curves remain source-authored. Owner iPhone visual approval is still REQUIRED, especially for the mid-gesture wrist, sleeve crossing, neutral-arm/body intersections and randomized crossfade timing. V12 is still opt-in on the original `greetingV11=1` QA URL to avoid production changes. No merge.

## V14 authoritative correction — 21 November 2026

Owner input: `Standing Greeting 2.fbx` SHA-256 `8ab3d94aaa0b6bfaf3616d54ad392cf46b502e328b5eabec40838b8db2b4c276`.
Owner iPhone evidence: `Video-test(20261121-145137).mp4`. V11/V12/V13 were rejected.

**Verified root cause:** The V11 source extractor incorrectly evaluated FBX's `PreRotation`, animated `Lcl Rotation` and `PostRotation` using intrinsic Euler `'XYZ'`. The EXISTING successfully-used Mixamo pipeline in `scripts/m3-idle/mixamo_retarget_pilot.py`, function `skeleton_sources`, uses **extrinsic** `scipy.spatial.transform.Rotation.from_euler('xyz', ...)`. This difference is material on Mixamo's strongly pre-rotated arm bones and caused an incorrect source-world delta even before any M3 retargeting. The previous V12 and V13 hand interventions masked that root cause instead of correcting it.

V14 re-parses the EXACT owner's binary FBX v7700 and reconstructs all 154 source frames (30Hz) with extrinsic `xyz`, correct source hierarchy and PreRotation / PostRotation inverse. It then samples world rotations relative to **original FBX bind/rest pose**, exactly like the accepted Mixamo retarget pilot. Target-local quaternion tracks are built from native target bind world rotations by the existing `createLocalReviewRetargeter` on each catalog-resolved M3 skeleton independently. **The experimental first-frame delta correction was explicitly withdrawn** because the accepted pilot uses bind rest, not frame 0. No V12 idle-arm overlay, no V13 forced overhead IK, no per-frame bone override.

V14 source asset: `public/m3-qa/standing_greeting_2_v14.b64` (5,805 gzip bytes encoded as 7,740 base64 characters; `SHA256(compressed) = 2dae169d4df3b6ceaff7b229b1ec78af7a3b68d0aa23f14ca97654b696220e9b`). Same validated `SG11` binary structure, opt-in QA only, no change to production / other clips. Compression: body <=0.75 degree adaptive source quaternion interpolation; proximal fingers <=3 degrees; middle/distal fingers still inherited from proximal (pre-existing compact candidate limitation), original FBX is not shipped. No extra mixers or scene rebuild.

**Source FK evidence** (FBX source positions, not M3 runtime visual acceptance):
- Frame 0: RightHand y is **75.05 cm below the Head bone joint**.
- Frame 45 / 1.5s: **26.28 cm below**.
- Frame 60 / 2.0s: **6.54 cm above the Head bone joint**.
- Frames 75–90 / 2.5–3.0s: **3.50–3.93 cm above that joint**.
- Frame 153: back to **75.05 cm below**.
These are *joint-based* measurements, not hand-above-scalp guarantees; source HeadTop_End is about 16–20cm above the wave wrist. Do NOT fake a higher hand by adding IK if the source does not have it.

The V11/V12 analysis claiming the FBX itself has both arms in a stationary T-pose was an artifact of the **incorrect intrinsic Euler** evaluation and is superseded by this V14 measurement.

**Validation gates:** (1) asset checksum, SG11 header and 154 frames; (2) source quaternion spot checks frame 60 against extrinsic reference; (3) TypeScript/Next build; (4) targeted male/female M3 + five-actor browser pose and unchanged mixer identities if test environment supports it; (5) owner iPhone approval still required. No merge.
