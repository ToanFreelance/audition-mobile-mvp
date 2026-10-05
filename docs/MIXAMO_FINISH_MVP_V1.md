# Mixamo Finish MVP v1 — offline candidate

Eight Moonlight Normal motions remain frozen. No DeepMotion, Astra V2.2,
runtime or gameplay changes. Only `finish-special-001` is appended.

## Measured sources

Blender import measured identical 65-bone Mixamo hierarchies/rest matrices,
zero meshes, centimetre scale .01 converted to metres and Blender Z-up.
Complete bone names/parents/object transforms are in `source-inspection.json`.

| File | Inclusive frames | FPS | Key span | Hip XYZ travel (metres, Z-up) |
| --- | --- | --- | --- | --- |
| Breakdance Swipes.fbx | 1–91 | 30 | 3.000 s | 1.192 / 1.119 / .392 |
| Flair 2.fbx | 1–31 | 30 | 1.000 s | .203 / .412 / .395 |

The FBXs contain animation only. Source previews display actual evaluated
source joints, not a claimed original source character mesh.

## Composition and target bake

Swipes frames 1–88; one Flair cycle phase-shifted to source frame 6. Remove
the duplicate cycle endpoint before phase shift, then restore the single
period endpoint. This does not add another cycle. Static yaw alignment −75°
and horizontal root alignment; eight-frame SLERP overlap at output frames
80–87. No time stretching or duplicated frames to reach an arbitrary length.

Output: 111 samples at 30 Hz, key span 3.666667 seconds; video 3.700 seconds
including the final sample's display interval. Flair has no standing recovery;
the candidate ends on the floor. No missing ending was fabricated.

Independent runtime targets: Nam 28 joints with original Running; Nu 66 joints
with original Walking. Reconstruct target world orientations from source
world motion, calibrated source rest frames and target bone/child axes.
Two-bone IK uses each target's limb lengths and source endpoint/pole trajectories.
No direct source local quaternion copying. Symmetric one-frame intrinsic
quaternion cleanup uses neighbour weight .18, no angular-speed cap.

The complete original skinned mesh is evaluated every frame; root height
corrects collisions to minimum 4 mm clearance. This is not physical palm force
or perfect horizontal contact locking. Original GLB binary prefix, meshes,
UVs, skin weights, inverse binds, textures/materials and existing clips stay
identical through the established append-only writer and validator.

## Review status

WARNING CANDIDATE; owner acceptance pending. First-pass rendered poses retained
inversion, floor entry and leg sweeps without observed limb explosion. Palm
contact and support transfer through the transition remain imperfect; large
angular steps remain warnings. Standing recovery is absent from source.
Structural PASS must not be equated with production visual acceptance.

First pass measured max angular steps Nam 63.87° → 44.85° and Nu 51.46° →
38.60° after cleanup; p99 28.58° → 24.56° / 24.51° → 19.76°. Read the delivered
QA JSON for the actual final reconstruction's metrics and verification.

The scratch workspace disappeared before first-pass packaging. Scripts and
measured parameters were restored without rerunning Normal motion extraction.
Source and final-GLB renders must complete again before delivery. Render-input
hashes and completion manifests prevent stale-frame reuse.

## Reproduction

Stage source FBXs in `upload/`, original target GLBs in `mixamo-inputs/rigs/`.
The artifact root is outside the Git repository.

```sh
blender -b --python scripts/astra-motion-poc/mixamo_inspect.py -- ARTIFACT_ROOT
python scripts/astra-motion-poc/mixamo_finish.py ARTIFACT_ROOT
blender -b --python scripts/astra-motion-poc/mixamo_render.py -- --input INPUT --out FRAMES --size 640
python scripts/astra-motion-poc/mixamo_package.py ARTIFACT_ROOT
```

Render swipes/flair/composite NPZ into swipes-render/flair-render/composite-render;
render exported Nam/Nu GLBs into male-render/female-render. Blender's Python
module can run the same scripts (`python script.py -- ...`) when the standalone
executable is unavailable. The package requires complete renders, decodes all
MP4s, and verifies ZIP CRC. No generated binaries are committed to Git.

The first pass ran 25 Python tests (22 existing + 3 focused) and syntax checks.
No application build/browser E2E is claimed for this offline asset task.
Finish gameplay semantics remain unchanged; only AUDIO END ends gameplay.
