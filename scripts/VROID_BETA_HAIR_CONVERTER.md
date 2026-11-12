# VRoid Beta Hair → GLB (experimental)

Converts the original creator ZIP's **Beta preset.json** into static GLB hairstyle geometry that can be attached to an avatar's Head in the isolated Vita Hair Studio.

## Run (Python 3.9+, standard library only)

```sh
python scripts/vroid-beta-hair-to-glb.py "Short_Bob_Hair_Preset_by_FeliKitty.zip" "Short_Bob_Approx.glb" --color '#ff4a97'
```

Also accepts `preset.json` directly. Does not accept arbitrary `.vroid` / `.vroidcustomitem` archives or ZIP files without the Beta preset. No dependencies, no network uploads.

The output preserves the authored centerline control points and their section/material assignments; each hair cross-section is reconstructed as a swept, closed diamond surface. It embeds the source grayscale textures, a configurable tint and `vroidHairHeadLocal: true` scene metadata. It is **not** a VRoid Studio-equivalent precise exporter and contains no hair physics.

## iPhone QA

Download the converted GLB from your ChatGPT conversation, save it to Files, open the branch preview `/tools/vita-hair-tryon`, load Vita Premium Variant A, then choose the **Short Bob + Pigtails** row's `Nạp file` (or the generic hairstyle file picker). Inspect front, 35°, side and back; fit and visual acceptance remain the owner's decision. Do not put paid/licensed third-party hair packages or converted assets in the public app repository without appropriate permission.