# Female Origin · Eye System V1 — isolated shader QA

STATUS: PROTOTYPE, owner visual acceptance pending. Not a production eye pack, not a blink rig.

## Input
Owner-provided Female_anime_origin.glb: approximately 42.6 MiB, 292,645 vertices, 499,762 triangles, 1 mesh, 1 material, no morph targets, no skin/skeleton.
The source GLB is NOT committed or uploaded to Supabase or GitHub. QA page loads a .glb selected through the browser File API.

## Route
Open /qa/female-origin-eyes-v1/ on work/female-origin-eye-qa-v1 preview and choose the original GLB from iPhone Files. Nine iris color/pattern experiments and before/after comparison.
V1 changes iris shader pigment directly on existing 3D GLB fragments, with Z-up asset-local region and violet hue mask. Original sclera, lashes and skin stay on the same mesh. Style selection updates shared shader uniforms and never reloads the model.

## Honest limitations
Style buttons are iris appearance tests only: no change in sad/angry/happy eyelid silhouette or brow shape. Star/heart are procedural pigment on the real 3D mesh, not separate modeled eyeball components.
GLB is a single merged mesh and has no blink blendshapes; V1 cannot honestly claim full modular eyes, facial expression, or optimized production geometry.
Shader mask bounds are calibrated against this specific original GLB. Other characters/retopologies require artist-approved sockets, distinct eyeball + iris, eyelid edge loops, expression shapes and re-test. Do not merge this route into production.

## Scope
Branch work/female-origin-eye-qa-v1 forked at 0e963c430d6a43b483f608bfa5ee236af167fe4f on work/modular-character-dance-qa-v1; PR #24 not modified.
No gameplay, WebAudio, gauge, Finish, Character Catalog, Waiting Room, RoomState, CAS, preload or Supabase changes.

## QA
Static HTML, Three.js 0.180 GLTFLoader, onBeforeCompile PBR patch, File API. Requires online CDN to obtain Three.js. Physical iPhone Safari, exact pixel fidelity and performance are not yet validated.