# Vita Wardrobe V0.4 — Tailored skinned Cyber Blue preview

Date: 2026-11-13
Branch: `work/vita-wardrobe-tryon-poc-v1`
Route: `/tools/vita-wardrobe-lab`

## Owner feedback and root cause

Physical iPhone screenshot of V0.3 rejected as visual baseline: torso is an oversized box/cylinder and both sleeves are oversized straight tubes; the Cyber Blue native UV atlas is incorrectly wrapped over approximate cylinders. This is the exact `approx-bone-follow-shell` fallback in prior `cyber-blue-tryon.ts` using three `CylinderGeometry` meshes. It was a static model loosely parented to bones, not a skinned VRoid garment.

## V0.4 scoped correction

- Removed the static cylinder fallback entirely.
- Procedurally generate a **tailored 3D torso** from multiple anatomical ring sections (collar, sloping shoulders, upper chest, waist and hem), with taper and different front/back depth.
- Generate narrower **tapered upper-arm sleeves**, oriented from real shoulder → elbow joint positions. Sleeve widths were reduced against the owner's rejected V0.3 screenshot.
- Build each generated piece as a `THREE.SkinnedMesh` with explicit skin indices/weights: torso blends Chest/Spine/Hips; sleeve starts blend Chest/UpperArm and becomes UpperArm-dominant. The inverse bind matrices are snapshots of the current skeleton pose, **without modifying the original avatar skeleton/boneInverse data**.
- Replaces naive mapping of the entire original 2048×2048 VRoid atlas onto a cylinder with **separate, stylistically remapped fabric atlases** (blue cuffs/sleeves, dark vest panel, seam/trim details) and a small motif sampled from the owner-imported source texture. Original exact UV is **not** claimed.
- Adds width (82–125%) and vertical lift (-8..8 cm) sliders; geometry is recalculated from an unmodified vertex baseline to avoid accumulating fit drift.
- Adds front / 35° / left / rear camera presets and an immediate try-on action under the 3D viewer for iPhone.
- Toggles remove and dispose generated meshes/materials/texture; no original V1.1 source buffers/materials/bind state are modified.
- If a compatible humanoid rig is missing, show a clear error instead of fabricating a cylinder preview. Source ZIP and creator-derived textures remain **browser-local**; nothing is bundled/publicly redistributed.

## Visual acceptance contract

Owner must test on a physical iPhone using saved `Cyber_Blue.zip` and SHA-approved Vita V1.1:
1. Import the ZIP and Vita V1.1.
2. Tap "Mặc thử Cyber Blue V0.4" directly below viewer.
3. Inspect collar, shoulder junctions, elbow cuff, waist silhouette and the material at front / 35° / side / rear; adjust width/lift if necessary.
4. Tap "Thử chuyển động vai" and verify sleeves deform with shoulder bones rather than rotate as rigid tubes. This is a **small pose probe, not an Audition dance stress test**.
5. Use "Khôi phục áo Vita" and confirm the original outfit returns identically.
6. Send screenshots/feedback. **Do not claim V0.4 owner acceptance before this QA**.

## Explicit limitations and risks

- Geometry and fabric UV mapping are **approximate**. This is **not** a converter of the original two VRoid templates `N00_005_01_Tops` and `N00_010_01_OnePiece`.
- Source `.vroidcustomitem` does not expose a finished rigged GLB. Exact conversion requires canonical geometry/UV or editor export via a legally permitted workflow.
- Clothing is layered over the original outfit, not equipped as a production-ready replacement. Source jacket may protrude, seams/intersections may exist at shoulders or with motion. Body-region occlusion, actual dance animation, physical cloth simulation and commercial license rights remain open.
- All code scoped to the isolated Wardrobe Lab; never change accepted Vita face, body/identity, original V1.1 asset, Character Catalog, RoomState/CAS/Realtime, WebAudio or gameplay. No merge, no PR.
- Automated validation: Vercel Next.js build/TypeScript on work branch; not a geometric/physical iPhone acceptance. No full Playwright / real dance QA run in this iteration.
