# Character Style A+B Demo V1 — isolated visual experiment

## Goal
Show a real, rotatable WebGL2 character in the Audition MVP without touching existing Character Catalog, Claude V2, EyePack, gameplay, Waiting Room, or WebAudio.

## Route
/tools/character-style-ab-v1

## Asset provenance and limitations
The prototype retrieves official VRoid Studio *AvatarSample_A* or *AvatarSample_B* via the public GitHub mirror:
https://github.com/madjin/vrm-samples/tree/master/vroid/stable

Original author is pixiv. These are not bespoke characters, not original OpenAI-produced mesh, and not the production-approved avatar. They are independent licensed style donors and do not reuse the project's Claude V2 / EyePack GLB. VRoid sample terms: https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z

Both VRM sample models allow commercial usage and modifications under the sample terms. Do not claim these are CC0. Before production, re-check upstream licensing and asset provenance.

## What is implemented
- Client-side Three.js WebGL2 3D viewer with orbit and pinch-to-zoom
- Responsive iPhone portrait layout; front, 3/4 L/R, face and full-body camera presets
- Two optional VRoid style reference samples (Mature face vs Fashion outfit)
- Soft lighting / autorotation / 180-degree facing switch
- Automatic fallback between GitHub raw and jsDelivr
- VRM/GLB local import (client-only)
- No backend, no production catalog changes, no gameplay changes

## Explicitly not implemented
- Bespoke re-sculpted A+B mesh, modular eye presets, blink integration, rig retargeting, or downloadable production character
- Browser/iPhone visual acceptance
- Pixel-perfect look vs approved Audition reference

## QA
- New isolated route and no external package added.
- Runtime asset is public URL: model not embedded in repo, requires network and permissive CORS.
- Preview availability and model rendering must be tested on real iPhone.
