# P3.7 human character and dance sources

Phase 3.7 keeps the active human humanoid on the proven Quaternius skeleton and replaces the temporary action-game placeholders with genuine dance motion. No Audition commercial character, clothing, texture, or animation asset is included.

## Human character

Active validation model: **Quaternius Universal Base Characters — Superhero Male**.

- Original author: Quaternius
- Original pack: Universal Base Characters
- License: **CC0 1.0 Universal**
- Runtime GLB mirror: `Ashen-Skool/Aot-Fable-5.1`
- Pinned mirror commit: `122378c422148390c781adc6d7019eda7b5d07f3`
- Runtime file: `assets/staged/anim/UBC_Superhero_Male_FullBody.glb`
- Skeleton: 65-bone UE-style humanoid (`root`, `pelvis`, `spine_01..03`, arms, legs and fingers)

The model is loaded from a commit-pinned jsDelivr URL. `CharacterActor` retains its procedural fallback if the external asset path fails.

## Stable same-rig support clips

Quaternius **Universal Animation Library 1 — Standard** is loaded from the same pinned mirror and the same skeleton family.

It is now used only for stable support/fallback presentation:

- `Idle_Loop` → `Idle`
- `Hit_Head` → `HumanMiss`
- `Dance_Loop` → emergency fallback for a dance slot if CMU motion cannot load
- `Roll` → emergency fallback for Finish if CMU Finish motion cannot load

Normal successful gameplay no longer maps dance slots to `Punch_Jab`, `Punch_Cross`, `Sword_Attack`, `Pistol_Shoot`, `Interact`, `Walk_Formal_Loop` or `Idle_Talking_Loop`.

## Real dance motion

Dance source: **Carnegie Mellon University Graphics Lab Motion Capture Database**, using Bruce Hahne's MotionBuilder-friendly BVH conversion mirrored by `una-dinosauria/cmu-mocap`.

- Mirror commit: `09a07f54f3bbb58797325f009282d0b2048a2871`
- CMU source take: `85_04` — `FancyFootWork`
- Finish source take: `87_01` — jump with kick and spin
- CMU states that the original motion database is free for use in research and commercial projects worldwide.
- Bruce Hahne's conversion adds no further restrictions.

To keep mobile download/parse cost bounded, one genuine ~21 second `FancyFootWork` routine is split into eight 2.5 second excerpts:

- `HumanDance01` — 0.25–2.75 s
- `HumanDance02` — 2.75–5.25 s
- `HumanDance03` — 5.25–7.75 s
- `HumanDance04` — 7.75–10.25 s
- `HumanDance05` — 10.25–12.75 s
- `HumanDance06` — 12.75–15.25 s
- `HumanDance07` — 15.25–17.75 s
- `HumanDance08` — 17.75–20.25 s

`HumanFinish` uses `87_01` from 0.15–4.15 s.

The source BVH files are not copied into this repository. They are fetched from commit-pinned URLs and converted once during character load into ordinary Three.js `AnimationClip`s.

## Why the retarget path changed

The first CMU attempt used name-only `SkeletonUtils.retargetClip()`. Bone names matched semantically, but CMU and Quaternius do not share identical local bone axes/rest orientations, so the iPhone build showed severe limb twisting.

The current adapter does **not** apply CMU local quaternions directly to Quaternius bones. Instead it:

1. captures both rigs in rest pose;
2. derives an anatomical world basis from hips/head/arms;
3. samples the CMU clip at 30 fps;
4. converts every mapped source bone to a rest-relative **world-space rotation delta**;
5. removes each excerpt's initial global heading;
6. aligns that physical world delta to the Quaternius anatomical frame;
7. solves the corresponding Quaternius local-bone quaternion;
8. writes those samples into a normal `QuaternionKeyframeTrack`.

The target `root` is never animated. CMU translation tracks are intentionally not transferred, so the gameplay character stays stage-centered. The existing 150 ms cross-fade hides the bounded excerpt boundaries.

If CMU loading fails, the affected dance slots fall back to the rig-compatible Quaternius `Dance_Loop`; they never fall back to gun/combat animations.

## Gameplay timing

This asset conversion does not own rhythm time.

The existing P3.3/P3.4 architecture remains unchanged:

- WebAudio is authoritative;
- successful motion starts from the player's exact `SPACE` judgement timestamp;
- phase is derived from `songTimeMs - actionStartSongTimeMs`;
- choreography selection remains deterministic by seed + absolute turn;
- blend progress remains song-time-derived;
- Miss and Finish remain presentation-only;
- Finish/global-turn scheduling is unchanged.

## Source rights references

- Quaternius Universal Base Characters: https://quaternius.com/packs/universalbasecharacters.html
- Quaternius Universal Animation Library: https://quaternius.com/packs/universalanimationlibrary.html
- CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
- CMU Motion Capture Database: https://mocap.cs.cmu.edu/
- BVH mirror / rights text: https://github.com/una-dinosauria/cmu-mocap/blob/master/READMEFIRST.txt
