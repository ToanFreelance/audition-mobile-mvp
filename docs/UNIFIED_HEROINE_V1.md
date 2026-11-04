# Unified Anime Heroine V1 — Technical Fusion Candidate

## Scope
Isolated /tools/unified-heroine-v1. Does not alter production Character Catalog, Waiting Room, RoomState, multiplayer, or WebAudio. PR #24 remains Draft. Owner visual acceptance pending.

## Provenance
- Canonical face, body, armature, bob, 56 morphs: pixiv VRoid Studio AvatarSample_A.
- Fashion skinned Top, Bottom, Shoes, hair: pixiv VRoid Studio AvatarSample_B.
- Remap donor mesh joint indices by name onto canonical A. Parent 54 nonshared B accessory/hair joints into the single A skeleton hierarchy. Keep B inverse bind matrices, source UVs, textures, source triangles.
- Real VRoid mesh data; never a 17-joint procedural character or 2D image facade.
- Source terms: https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z

## Build
python3 scripts/unified-heroine-v1/build_unified.py
Uses Python standard library, downloads two original 15 MB VRMs when not cached. Run via prebuild; binary not committed (30 MB generated output).

## Current QA state / caveats
- Blender 5.0.1 import of candidate succeeded; 157 bones in one armature, A face 56 morphs.
- A/B skeleton rest translation differences: fit and dance clipping NOT yet approved.
- Eye presets currently tint source iris materials; not EyePack geometry.
- Premium garments are source VRoid B geometry, not a new artist-sculpted premium design.
- Original VRM extension is stripped for GLB output; glTF facial target names retained.
- Short demo dance track is local-only, never controls gameplay WebAudio.
- Mobile rendering, outfit swapping while dancing, visual Golden Reference match and owner physical iPhone acceptance pending.
- Terms of the original pixiv VRoid sample require recheck before production distribution.
