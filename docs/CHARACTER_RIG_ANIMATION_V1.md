# Character Rig + Audition Animation V1

## Scope

Work branch: `work/character-rig-animation-v1`

Base: latest `development` after P5.6 merge.

This lane is isolated from Stage Catalog and must not change gameplay authority, WebAudio timing, gauge, Finish semantics, sequenceCounts, RoomState, CAS, Realtime, preload, or shared-start behavior.

## Current character inputs

Owner-supplied Meshy auto-rig outputs:

- male: Mixamo-compatible skinned GLB, 28-joint body rig, Running clip embedded;
- female: Mixamo-compatible skinned GLB, 66-joint full-hand rig, Walking clip embedded.

The final character assets should preserve the original model's visual appearance/materials/textures while using the external auto-rig skeleton + skin weights. Do not promote either character into Character Catalog until owner iPhone QA accepts deformation.

## Current published animation release

Supabase animation release v4 contains:

### Normal

1. Hip Hop Dancing
2. Silly Dancing
3. Salsa Dancing
4. Swing Dancing
5. Wave Hip Hop Dance
6. Breakdance Freezes
7. Jazz Dancing
8. Samba Dancing
9. YMCA Dance
10. Macarena Dance
11. Rumba Dancing
12. Northern Soul Spin
13. Twist Dance

### Final

1. Breakdance Freezes
2. Capoeira
3. Flair

### Lobby idle

1. Standing Greeting
2. Happy Idle
3. Breathing Idle
4. Standing Idle

The gameplay semantic choreography contract remains eight normal IDs plus one Finish ID:

- dance-01
- dance-02
- dance-03
- dance-04
- dance-05
- dance-06
- dance-07
- dance-08
- finish-special

## Audition-style target library

Do not increase the gameplay turn count or create extra turns. More visual variety should come from multiple presentation variants inside the existing eight semantic dance slots.

### dance-01 — Basic groove / side step

- side-step groove
- step-touch with arm swing
- bounce + shoulder groove

### dance-02 — Arm wave / upper-body

- arm wave
- cross-arm wave
- chest/body wave

### dance-03 — Cross-step / footwork

- cross-step
- heel/toe footwork
- shuffle phrase

### dance-04 — Hip / twist

- hip sway
- twist
- body-roll + hip accent

### dance-05 — Kick / accent

- kick-step
- knee lift + arm accent
- side kick + recovery

### dance-06 — Spin / turn

- single spin
- turn + pose
- spin + arm sweep

### dance-07 — Low / break-style

- low groove
- squat / floor-touch phrase
- break-style low transition

### dance-08 — Power / freestyle

- large diagonal arm phrase
- jump / power step
- freestyle combo

Target normal pool: 16–24 clips total, ideally 2–3 variants per semantic slot.

## Finish target library

Finish remains a presentation-only special command and is not game-end.

Target 4–6 Finish clips:

1. spin + kick finish
2. jump-turn finish
3. breakdance freeze
4. flare / floor-power move
5. capoeira-style finish
6. dramatic pose / recovery

Only AUDIO END ends the game.

## Failure reactions

Keep separate from dance variants:

- BadReaction
- MissReaction

Both are bounded one-shots and must return to Idle without changing the global timeline.

## Video reference requirements

Higher-quality original Audition video is preferred for reconstructing Audition-style motion.

Best source characteristics:

- 720p or 1080p if available;
- 30 fps minimum, 60 fps preferred;
- full character body visible from head to feet;
- minimal UI/FX covering limbs;
- camera angle as frontal as possible;
- several consecutive turns at stable camera angle;
- include Normal, Finish, Bad/Miss if possible;
- audio is useful because BPM/beat alignment lets us cut exact four-beat phrases.

For every accepted source phrase, record:

- source video;
- start/end timestamp;
- BPM / beat span;
- semantic slot;
- normal/final/reaction role;
- left/right orientation notes;
- occlusion/confidence notes.

## Runtime direction

Keep WebAudio as authoritative phase source.

Normal visual variety should be added as a presentation variant layer under the existing semantic choreography IDs rather than modifying gameplay turn selection.

Conceptually:

`dance-01 -> [variant A, variant B, variant C]`

The selected variant must be deterministic from stable presentation data and must not affect score, judgement, command generation, turn count, level length, or audio timing.

## Acceptance order

1. Preserve original textures/material appearance on Meshy-rigged character.
2. Validate male/female deformation on iPhone with current Idle / Normal / Miss / Finish.
3. Accept canonical character rig.
4. Curate high-quality Audition video references.
5. Build Audition-style motion candidates.
6. Retarget/bake into the accepted canonical character rig.
7. Owner iPhone animation QA.
8. Only then add new Character Catalog entries / Create Character / Waiting Room demo integration.
