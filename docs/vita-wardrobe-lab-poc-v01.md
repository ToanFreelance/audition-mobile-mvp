# Vita Wardrobe Lab POC V0.1 — Cyber Blue intake (2026-11-12)

**Branch**: `work/vita-wardrobe-tryon-poc-v1` (isolated, no merge).
**Route**: `/tools/vita-wardrobe-lab`

## User authorization and intent

Owner accepted the full Vita Hair Studio demo as the modular-hair research baseline. Owner explicitly approved starting the first clothing experiment, targeting the *Cyber Blue Outfit Set* top on approved Vita Premium Variant A. Preserve approved Vita V1.1 face/outfit, skeletal identity, gameplay and Character Catalog.

## Source / legal status

- BOOTH listing: https://booth.pm/en/items/5798462
- Creator lists a free 5.47 MB ZIP with 3 `.vroidcustomitem` pieces (top, skirt, shoes), 0 JPY, no headset/model.
- Terms: modifying texture allowed; commercial use requires creator credit; redistribution prohibited. Rights to embed extracted asset in a distributable game are **not confirmed**.
- A public listing link is **not the actual source ZIP**. Attempts to retrieve the unauthenticated BOOTH `downloadables/4594244` URL from available tools did not return binary content; no garment mesh or creator file has been obtained. Do not claim a converted Cyber Blue GLB exists.
- No creator ZIP, proprietary texture, or derivative asset was committed.

## Implemented: local intake QA, not outfit mesh conversion

- Browser-local ZIP central-directory parser with bounded decompression, entry-count and size limits (32 MB archive / 24 MB entry / 96 MB declared total), safe path checks, no server-side upload.
- Accept a source `.zip` containing `.vroidcustomitem`, or standalone `.vroidcustomitem`.
- Read each supported nested custom item and its internal `meta.json`, `v1customitem/meta.json`, and `thumbnails/thumbnail.png` or JPEG.
- Display thumbnails, version and file-name-inferred category (**not authoritative VRoid clothing category**).
- Keep avatar 3D reference separate: load public Vita CC0 as fallback or manual approved Variant A `.glb` / `.vrm` by exact SHA-256 allowlist. No modification to base avatar, no outfit swap falsely implied.
- Existing Vita Hair Studio demo is unchanged on its own branch.

## Actual validation

Local Node 22 test: `inspectWardrobePackage()` succeeded against a real owner-supplied VRoid Stable 1.8 `.vroidcustomitem` archive (from the prior *hair* sample), returning one item, six internal ZIP entries and a valid thumbnail object URL. **This tests the shared archive container format, not Cyber Blue or the classification of clothing.**

No physical iPhone acceptance of this POC yet. No successful Cyber Blue upload/preview/mesh fitting has been observed. Next test requires the owner to download `Cyber_Blue.zip` from the BOOTH listing in iPhone Safari and load it into this page.

## Explicit next technical gate

Inspect the **actual Cyber Blue top** `.vroidcustomitem` for source template and texture parameters. A `.vroidcustomitem` is *not* a skinned garment GLB. Reconstruct/export from VRoid's clothing template, or accept a creator-authorized rigged garment; then align bind pose, bone names, inverse bind matrices, skin weights and occluded body geometry. Only after test coverage for neutral pose, turning, dance animations and clipping on the approved Vita V1.1 should this become a modular clothing item.

**No gameplay / WebAudio / RoomState / Character Catalog / Waiting Room modifications. No PR or merge.**