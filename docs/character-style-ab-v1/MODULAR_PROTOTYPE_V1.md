# Fashion B — Modular Prototype V1

Scope: isolated visual feature added to the existing \`/tools/character-style-ab-v1\` route. This task is authorized by owner to demonstrate customization of the approved Fashion B visual direction with A-style softness.

## What is real
- Reuses two independent VRoid samples (A, B), **not** Claude / original eye-pack mesh.
- Actual geometry overlays attach to the loaded Three.js model scene: ponytail mesh, premium jacket accents, glasses, sparkle decals.
- Mutates the exported VRM material tint for named iris, hair and outfit materials only. Original colors cached and restored for each preset.
- 3 eye looks: Natural, Doll purple, Idol blue. If dedicated iris materials don't exist, **DO NOT pretend** the actual iris was replaced; UI displays that no iris material was matched.
- 2 hair looks: original and color-tinted add-on ponytail.
- 2 outfit looks: original Basic and layered Premium shells / accent material tint.
- accessory toggle: 3D glasses with their own geometry.
- All visual state is local to one demo page. No buy button, account entitlement or VIP gate exists.

## Not production-ready
- VRoid sample geometry/UV/skin binding not re-authored.
- Overlay fashion pieces are approximate and NOT true skinned clothing. Materials are original sample content.
- Not a production-ready modular Face Catalog, Hair Catalog or Fashion Catalog.
- Can't assert quality or exact facial alignment without actual WebGL/iPhone QA.
- No production character replacement or shop feature.

## Manual acceptance
1. Open route on iPhone Safari.
2. Switch Fashion Idol, full and face camera.
3. Change Natural/Doll/Idol and read iris material-matched status.
4. Change Classic/Ponytail, Basic/Premium, glasses on/off.
5. Orbit 360°, verify clipping in each preset.
6. If visual is accepted, author truly independent SkinnedMesh garments and head-fit modular eyes on a custom character with appropriate rights.

## Deployment policy
Commit only to work/facial-modular-eye-demo-v1; PR #24 remains Draft. No merge or production changes.
