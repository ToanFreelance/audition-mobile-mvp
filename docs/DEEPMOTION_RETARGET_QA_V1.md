# DeepMotion → Meshy Audition Retarget QA V1

## Scope

Branch: `work/character-rig-animation-v1`

Base: `development@d27168929f9923b1de561133b941977d039d56a1`

This pass is isolated from Character Catalog, Waiting Room authority, WebAudio timing, score/gauge, sequenceCounts, Finish semantics, multiplayer protocol and Stage Catalog.

## Source motion

Owner supplied DeepMotion outputs from the successful Normal capture:

- FBX package: `audition_normal_two_actor_20s_customModel_all_characters_fbx.zip`
- GLB package: `audition_normal_two_actor_20s_customModel_all_characters_glb.zip`

DeepMotion source GLB:

- generator: `FBX2glTF v0.13.1`
- duration: ~20.0 seconds
- frames: 601 @ 30 fps
- skeleton: 52 joints
- animated channels: 52 rotations + hips translation
- tracked actor: owner-selected Track 2
- hand tracking: disabled

## Retarget target

QA-only textured Meshy rigs:

- `Nam_co_ban_MESHY_TEXTURED_RIG_v1.glb`
- `Nu_co_ban_MESHY_TEXTURED_RIG_v1.glb`

Target skeletons:

- male: 28 joints
- female: 66 joints

Only the 22 canonical body joints are transferred in v1. Finger tracks are intentionally not transferred because DeepMotion Hand Tracking was disabled.

## Retarget method

DeepMotion's reference skeleton is T-pose and its local bone axes differ from the Meshy skeleton.

Directly copying quaternion deltas double-applies the Meshy A-pose shoulder offset and produces incorrect arms.

V1 therefore:

1. derives each source bone's primary rest direction from its child translation;
2. derives the corresponding Meshy bone direction;
3. creates a target animation reference orientation by minimally rotating the Meshy rest bone direction onto the DeepMotion T-pose direction while preserving target twist;
4. applies the DeepMotion animated global bone delta to this reference;
5. converts resulting target global rotations back into target-local quaternions.

Internal direction validation for upper arms, forearms, thighs and lower legs matches the DeepMotion source direction to numerical precision for sampled frames.

## Added QA animations

Each output GLB keeps the original Meshy clip and adds:

### `Audition_Normal_Full_DM_v1`

- full ~20 second capture
- QA only
- preserves root motion relative to the first captured frame
- not intended as one gameplay turn

### `dance-05_kick-cross-step_v1`

- source video range: 198.229–200.226 seconds
- actual capture duration after frame snapping: ~2.0000 seconds
- mapped to semantic `dance-05`
- horizontal root translation is recentered so start/end have zero net drift

### `dance-08_arm-sweep-back-kick_v1`

- source video range: 204.730–206.750 seconds
- actual capture duration after frame snapping: ~2.0333 seconds
- mapped to semantic `dance-08`
- horizontal root translation is recentered so start/end have zero net drift

At the captured tempo (~117.45 BPM), these are approximately one four-beat phrase.

## Generated QA files

- `Nam_co_ban_MESHY_DM_AUDITION_v1.glb`
- `Nu_co_ban_MESHY_DM_AUDITION_v1.glb`

Expected animation lists:

Male:
- Running
- Audition_Normal_Full_DM_v1
- dance-05_kick-cross-step_v1
- dance-08_arm-sweep-back-kick_v1

Female:
- Walking
- Audition_Normal_Full_DM_v1
- dance-05_kick-cross-step_v1
- dance-08_arm-sweep-back-kick_v1

## Structural validation

- source motion parsed successfully;
- target skins preserved;
- original PBR materials/textures preserved;
- all generated quaternions finite and normalized;
- no NaN/Inf animation samples;
- dance-05 and dance-08 have zero net horizontal root displacement after recentering;
- original Meshy skeleton hierarchy and inverse bind matrices remain unchanged.

## Owner QA

Load both files in:

`/tools/character-rig-qa`

Inspect:

- shoulder/armpit deformation;
- elbows/wrists;
- hip/crotch;
- knees/ankles;
- foot sliding;
- root travel;
- skin tone/materials;
- whether the two extracted phrases visually match the Audition source.

Do not publish into Character Catalog or the animation release until owner iPhone acceptance.
