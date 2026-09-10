# Asset licenses

## Character demo — Quaternius Ultimate Modular Women Pack

- Purpose in this branch: temporary/prototype animated human character and outfit preview.
- Author: Quaternius.
- Official pack page: https://quaternius.com/packs/ultimatemodularwomen.html
- License: CC0 1.0 Universal / Public Domain Dedication.
- Commercial use: allowed by the pack license.
- Prototype models used: `Casual.gltf`, `Punk.gltf`, `Formal.gltf`.
- Runtime prototype source: public `agentkaerf/FreeModels` GitHub mirror of the Quaternius pack.

This prototype intentionally loads the self-contained glTF files from the public mirror so no binary model asset needs to be committed for the experiment. Before production, vendor/pin the selected CC0 source into project-owned storage/CDN so gameplay does not depend on a third-party raw GitHub URL.

## Demo accessories

The headphones and glasses shown by `components/Stage3D.tsx` are generated at runtime with Three.js geometry by this project. They do not depend on an external 3D asset.

## Important

This demo proves the rendering/animation/wardrobe pipeline only. The three outfit buttons currently swap complete Quaternius character presets. A production Audition-style wardrobe should move to separate skeletal clothing meshes (hair/top/bottom/shoes/accessories) sharing one standardized humanoid rig.
