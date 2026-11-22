# Eye Asset Pack V1.9.3 — Eye-Region Beautification Candidate

**Status: PARTIALLY READY — OWNER VISUAL ACCEPTANCE PENDING.**

## Why V1.9.2 was rejected
The owner-approved concept uses a cohesive feminine upper lash line, tapered eyeliner wing, expressive lashes and warm pink upper lid. V1.9.2 improved iris/aperture placement but retained sparse disconnected lash strands, pale eyelid and a generic socket that made Natural/Doll look wide-eyed. Merely scaling the aperture or changing iris was rejected in prior iterations.

## Focused real 3D reconstruction
- **Source GLB V1.9.2:** SHA-256 `7221dac79642b283f85740c3ca3053d49f19f52aabf29a6296fb091c0f265cf2`, kept unchanged.
- **New V1.9.3 GLB:** SHA-256 `a80088aed5356e2b1b7344f347d77e9c240fdd1ae0755c3771b9de12d31869e4`; 51,733,472 bytes.
- **CDN:** https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/0d4500f1-242f-4d8d-aa47-5fb7e764d2b5.glb
- **Nine-eye QA contact sheet:** https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/6a09d7f3-97c2-419f-96bc-489854c8ae79.jpg
- **Changes:** For each of nine looks and both eyes, author six new **real glTF triangle-mesh components** attached to exported local eyelid geometry: curved lash fan, continuous upper eyeliner, lower waterline, eyelid crease, swept feathered wing and soft pastel upper-lid shade. All new components have independent `Blink`/`BlinkArc` POSITION and NORMAL morph targets derived from the corresponding eyelid poses. Old sparse lash nodes are retained only as inactive rollback data and not loaded into either active scene.
- The original head/skin/lid/ocular meshes, nine accepted iris textures, materials, source UVs and Character Catalog remain **byte-identical** with V1.9.2. No cosmetic 2D overlay/fake GLB. No modification to gameplay or Waiting Room.
- A short experimental pass produced dagger-like outer lashes; it was visually rejected. Final outer lashes were shortened/curled and a feathered geometry wing substituted.
- Runtime toggles `LashFan_V193` with the existing No Lash choice; eyeliner/crease remain independent. New GLB URL + cache version prevent stale browser CacheStorage.
- **Important limitation:** this is a meaningful real 3D *eye-region makeup and lash geometry reconstruction*, **not full freehand resculpt of the inherited Claude V2 skin/socket topology**. It improves visual mood but still differs from the accepted 2D illustration.

## Validation actually run
- Source SHA verified and identical output SHA reproduced by independently rerunning `rebuild_eye_frames.py` with the same input.
- Khronos glTF Validator: **0 errors, 6 warnings, 6 infos** (inherited normal/tangent-space issues).
- Focused geometry regression `qa_geometry.py`: **PASS**, 108 new modules across 9 looks, 23,544 new triangles, all morph targets finite and index ranges valid, original face/ocular/skin/iris source data unchanged, old lash nodes inactive in both scene manifests.
- Blender 4.5 Cycles CPU: export, reimport and render nine looks at the same camera/light; Natural and Doll rendered at open, half and full closure. (No real iPhone Safari QA.)
- Chromium Headless WebGL2/ANGLE SwiftShader: GLTFLoader parsed/rendered new GLB for Natural, Doll, Joyful, Sad and Heart; browser errors captured: none.
- **Not run:** full Playwright E2E suite and physical iPhone visual acceptance/performance/thermal testing. Next.js/Vercel build must be confirmed on exact commit separately.

## Reproduce
```bash
python3 scripts/eye-pack-v193/rebuild_eye_frames.py <source-v192.glb> <output-v193.glb>
python3 scripts/eye-pack-v193/qa_geometry.py <source-v192.glb> <output-v193.glb>
```
Requires NumPy and sibling `scripts/eye-pack-v19/glb_tools.py`. Use the same source SHA or results are not guaranteed identical. Blender/render scripts from V1.9.1 are used for additional art QA.

## Risk and gate
- Eye socket remains influenced by Claude V2 source head shape; full concept matching, realistic blink at profile angles, color appearance in iPhone Safari and GPU performance are **NOT accepted**.
- CDN file ~51.7MB can affect cold-load bandwidth, memory and CPU. Browser cache mitigates repeated downloads but not initial load.
- PR #24 stays **Draft**, no merge or production Character Catalog registration. Owner iPhone comparison is the final acceptance gate.
