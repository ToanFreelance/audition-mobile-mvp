# Phase 3 character assets

## Active human character + animation library

The active P3.7 character is **Superhero Male** from Quaternius's **Universal Base Characters — Standard** pack. The active animation source is the free **Universal Animation Library 1 — Standard** pack from the same author.

Both packs are distributed under **CC0 1.0 Universal** and use Quaternius's current 65-bone UE-style humanoid skeleton (`root`, `pelvis`, `spine_01..03`, `neck_01`, `Head`, `clavicle_l/r`, `upperarm_l/r`, etc.). The matching skeleton is intentional: runtime CMU-to-Quaternius retargeting was removed after physical iPhone QA exposed severe bind-axis/rest-pose deformation.

Official sources:

- Universal Base Characters: https://quaternius.com/packs/universalbasecharacters.html
- Universal Animation Library: https://quaternius.com/packs/universalanimationlibrary.html
- License: https://creativecommons.org/publicdomain/zero/1.0/

Runtime files are loaded from a commit-pinned public mirror in `Ashen-Skool/Aot-Fable-5.1` at commit `122378c422148390c781adc6d7019eda7b5d07f3`:

- `assets/staged/anim/UBC_Superhero_Male_FullBody.glb`
- `assets/staged/anim/UAL1_Standard.glb`

That mirror documents the files as the free Quaternius Standard tiers and preserves the common 65-bone skeleton. The application uses the non-root-motion UAL1 variant. No character model, animation, clothing, texture or geometry is extracted from Audition.

The current P3.7 presentation pool maps a small subset of UAL1 clips into the existing song-time-driven controller. These are temporary production-pipeline motions rather than a claim of final Audition choreography. WebAudio/gameplay timing remains authoritative.

## Legacy P3.1 RobotExpressive validation asset

`character.glb` in this directory is the **RobotExpressive** test model distributed with the official Three.js examples. It was the active Phase 3 validation asset through P3.6 and is retained only as a legacy/debug reference.

- Original model: Tomás Laulhé / Quaternius
- Three.js modifications: Don McCurdy
- Source: `mrdoob/three.js`, tag `r180`, `examples/models/gltf/RobotExpressive/RobotExpressive.glb`
- Upstream commit: `0af9729d0c143a86a1d725d6e2c3ad83301f3f34`
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- SHA-256: `047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319`

The legacy asset is not extracted from Audition and contains no Audition geometry, textures, clothing or animations.
