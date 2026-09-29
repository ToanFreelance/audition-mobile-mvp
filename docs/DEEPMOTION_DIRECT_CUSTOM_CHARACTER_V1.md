# DeepMotion Direct Custom-Character Retarget V1

## Why this path exists

Local cross-skeleton retarget attempts v1/v2 were rejected in owner iPhone testing because the Meshy-skinned character deformed heavily.

The rejected approach converted DeepMotion joint rotations onto the Meshy skeleton locally. Even when joint directions were plausible, source/target bone-frame roll differences caused severe skin twisting.

Do not continue that path.

## New direction

Use DeepMotion's Custom Character feature so DeepMotion retargets video motion directly onto the actual Meshy skeleton.

Current official DeepMotion guidance supports custom rigged FBX/GLB humanoid characters and recommends:

- one full-body humanoid character;
- one root joint;
- T-pose default pose;
- feet on the ground plane;
- clean hierarchy;
- unique joint names without spaces;
- approximately human scale;
- no unnecessary animations/environment data in the upload.

## Prepared upload assets

Owner-download artifacts generated outside the repo:

- `Nam_MESHY_DEEPMOTION_CUSTOM_TPOSE_v1.glb`
  - Meshy 28-joint rig
  - zero embedded animation clips
  - explicit skeleton root: `mixamorig:Hips`
  - shoulder/arm/forearm chains posed horizontally for T-pose input
  - 67.5 MB

- `Nu_MESHY_DEEPMOTION_CUSTOM_TPOSE_v1.glb`
  - Meshy 66-joint full-hand rig
  - zero embedded animation clips
  - explicit skeleton root: `mixamorig:Hips`
  - shoulder/arm/forearm chains posed horizontally for T-pose input
  - 67.8 MB

Both files are below DeepMotion's 100 MB Freemium custom-character upload limit.

## Execution order

Start with male only.

1. Reuse the already successful Audition Normal 20-second input video.
2. Choose the same clean dancer track.
3. At Select Character, choose/upload custom character.
4. Upload `Nam_MESHY_DEEPMOTION_CUSTOM_TPOSE_v1.glb`.
5. Keep body tracking only for the first pass.
6. Physics Filter ON.
7. Foot Locking Auto.
8. Hand/Face tracking OFF.
9. Generate the motion.
10. Download custom-character GLB output and return it for inspection.

If successful, the output animation is already authored on the Meshy bone hierarchy. Runtime integration then becomes animation-channel transfer by exact node name to the original-textured Meshy character asset, not cross-skeleton retargeting.

## Runtime rule

Do not promote the DeepMotion upload-only T-pose file into Character Catalog.

Final runtime asset remains the accepted original-textured Meshy character plus animation clips copied from the DeepMotion custom-character output.

No gameplay contract changes:

- WebAudio remains authoritative.
- 1 global turn = 4 beats.
- `dance-01 ... dance-08` remain semantic gameplay IDs.
- additional motion variety is presentation-only.
- Finish remains a bounded presentation command.
- only AUDIO END ends the game.
