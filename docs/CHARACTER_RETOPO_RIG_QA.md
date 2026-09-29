# Character Retopo Rig QA v1

Branch: `work/character-rig-qa`

This QA work is isolated from P5.6 Waiting Room. It must not be promoted into Character Catalog or Waiting Room until owner iPhone acceptance.

## Root cause

The original generated meshes are extremely dense and highly fragmented:

- male: ~491k triangles / hundreds of connected surface components;
- female: ~492k triangles / hundreds of connected surface components.

Repeated weight-only fixes left sleeve/torso triangles stretching during large shoulder rotations.

## Retopo QA v1

The QA asset rebuilds each character as three independently reconstructed surfaces sharing one skin/skeleton:

1. core body;
2. left arm + sleeve;
3. right arm + sleeve.

This prevents a triangle from spanning from a moving sleeve into the stationary torso.

### Result

- male: 47,952 vertices / 95,997 triangles / 9 components;
- female: 47,971 vertices / 95,999 triangles / 12 components;
- 23-bone canonical QA skeleton;
- QA_Idle / QA_NormalDance / QA_Miss / QA_Finish embedded;
- vertex colors baked from the original base-color texture for stable QA appearance after topology reconstruction;
- JOINTS_0 range 0..22;
- normalized skin weights sum to 255/255 per vertex.

Runtime integration remains intentionally out of scope until owner acceptance.
