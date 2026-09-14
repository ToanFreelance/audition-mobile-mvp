# P3.7 human animation skeleton fix

Owner iPhone QA of the first P3.7 human-asset swap exposed severe skeleton deformation during every CMU BVH-derived motion while the neutral human pose itself stayed correct.

Root cause: the runtime used name-only `SkeletonUtils.retargetClip()` between the CMU BVH MotionBuilder skeleton and Quaternius's 65-bone UE-style base-character skeleton. Bone names could be mapped, but their bind/rest orientations and local axes were not equivalent, so valid CMU rotations were evaluated in incompatible Quaternius bone spaces.

Correction:

- remove CMU/BVH runtime retargeting from the active human path;
- load Quaternius **Universal Base Characters — Standard** and **Universal Animation Library 1 — Standard** from the same current 65-bone skeleton family;
- use the non-root-motion UAL1 GLB and clone its authored clips directly by matching node/bone names;
- bind the `AnimationMixer` to the complete character hierarchy so direct glTF node tracks resolve against the target bones;
- preserve the existing WebAudio-derived action anchor, deterministic choreography selection, 150 ms cross-fade, Miss one-shot → Idle, Finish one-shot → Idle and all gameplay/Finish scheduler invariants.

The current UAL1 motion subset is still temporary choreography for Phase 3 validation; final dance art can be replaced without changing the timing/controller architecture.
