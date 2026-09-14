# P3.7 human validation character and dance sources

Phase 3.7 replaces the active RobotExpressive validation character with a pinned human humanoid plus curated public mocap. No Audition commercial character, clothing, texture, or animation asset is included.

## Human character

Active validation model: **Quaternius Universal Base Characters — Superhero Male**.

- Original author: Quaternius
- Original pack: Universal Base Characters
- License: **CC0 1.0 Universal**
- Prepared GLB source used by this project: `programasweights/avatar`, `public/assets/character.glb`
- Pinned source commit: `ddd5fc34a445bcded3cf9836607aaeebc19a5c78`
- Prepared GLB size: 741,320 bytes
- Runtime URL: pinned jsDelivr mirror of that exact commit
- The prepared derivative keeps the Quaternius humanoid skeleton and uses a simple material with no embedded image payloads.

The model is loaded from the pinned CDN during this validation milestone rather than copying a large binary into the repository. `CharacterActor` retains its procedural fallback if the external asset or animation sources cannot be loaded.

## Dance / reaction motion data

Motion source: **Carnegie Mellon University Graphics Lab Motion Capture Database**, using Bruce Hahne's MotionBuilder-friendly BVH conversion as mirrored by `una-dinosauria/cmu-mocap`.

- Mirror commit pinned by this project: `09a07f54f3bbb58797325f009282d0b2048a2871`
- CMU states that the original dataset is free for use in research and commercial projects worldwide.
- Bruce Hahne places no additional restrictions on this BVH conversion.
- The project downsamples the selected windows to 30 fps during one-time load/retarget and does not redistribute the source BVH files themselves.

Curated P3.7 set:

- `85_04` — FancyFootWork → `HumanDance01`
- `90_28` — breakdance → `HumanDance02`
- `90_30` — russian dance → `HumanDance03`
- `90_31` — russian dance → `HumanDance04`
- `90_32` — moonwalk → `HumanDance05`
- `93_03` — charleston_01 → `HumanDance06`
- `93_06` — lindyHop2 → `HumanDance07`
- `93_08` — xtra fancy charleston → `HumanDance08`
- `80_45` — crying → `HumanMiss`
- `87_01` — Jump with kick and spin → `HumanFinish`

## Retargeting / root motion

Three.js `BVHLoader` and `SkeletonUtils.retargetClip` are used only once during character load with a fixed Quaternius-to-CMU bone map. This is a focused adapter for this asset pair, not a gameplay scheduler and not a general retargeting framework.

The generated pelvis translation track is removed so CMU locomotion cannot move the gameplay character away from the fixed stage root. Bone rotations and dance body motion are preserved. Animation phase, blend progress, SPACE anchors, Finish scheduling, and global turns remain owned by the existing P3.3/P3.4 gameplay-presentation architecture.

## Source rights references

- Quaternius: https://quaternius.com/packs/universalbasecharacters.html
- CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
- CMU Motion Capture Database: https://mocap.cs.cmu.edu/
- BVH mirror / rights text: https://github.com/una-dinosauria/cmu-mocap/blob/master/READMEFIRST.txt
