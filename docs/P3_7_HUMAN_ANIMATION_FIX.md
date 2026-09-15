# P3.7 human animation skeleton fix

Owner iPhone QA of the first P3.7 human-asset swap exposed severe skeleton deformation during CMU BVH-derived motion while the neutral human pose itself stayed correct.

## Root cause

The first implementation used name-only `SkeletonUtils.retargetClip()` between the CMU BVH MotionBuilder skeleton and Quaternius's 65-bone UE-style skeleton. Bone names could be mapped semantically, but bind/rest orientations and local bone axes are different. Applying CMU local quaternions in Quaternius local bone space therefore twisted limbs.

A temporary safety correction moved all active clips to Quaternius UAL1, which shares the exact character skeleton. That proved the model, skin and animation-controller path were correct, but UAL1 Standard contains only one true dance clip and made the game look like an action/shooter when combat clips filled the remaining choreography slots.

## Current correction

The human model remains Quaternius UBC and stable support clips remain same-rig UAL1.

Normal successful choreography is now genuine CMU dance again, but the conversion method changed:

- use CMU `85_04 FancyFootWork`, split into eight bounded excerpts;
- use CMU `87_01` for the Finish special;
- load BVH rotations only and sample them once at 30 fps during character load;
- capture both skeletons in their rest pose;
- derive an anatomical world basis from hips/head/arms;
- convert each source bone to a rest-relative **world-space** rotation delta;
- remove the excerpt's initial global heading;
- align that world delta to the Quaternius anatomical frame;
- solve Quaternius local quaternions from the desired world transforms;
- bake the result into ordinary `QuaternionKeyframeTrack`s addressed by Quaternius bone names.

The target `root` and CMU translation tracks are not animated, keeping the actor centered on stage. If CMU loading/conversion fails, normal dance falls back only to Quaternius `Dance_Loop`, never to gun/combat clips.

## Architecture preserved

This conversion happens only when the character asset loads. Runtime dance phase is still owned by the existing animation controller:

- WebAudio remains authoritative;
- exact SPACE timestamp remains the action anchor;
- phase remains `songTimeMs - actionStartSongTimeMs`;
- deterministic choreography selection is unchanged;
- cross-fade remains 150 ms and song-time-derived;
- Miss remains a bounded one-shot then Idle;
- Finish remains presentation-only and cannot alter the global scheduler.

No gameplay, gauge, Finish cadence/rest, P3.5 framing or P3.6 render-profile semantics are changed by this correction.
