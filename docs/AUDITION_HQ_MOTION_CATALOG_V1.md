# Audition HQ Motion Catalog V1

Branch: `work/character-rig-animation-v1`

Base development SHA:

`d27168929f9923b1de561133b941977d039d56a1`

This document records the first beat-aligned motion catalog extracted from the two higher-quality Audition gameplay videos supplied by the owner on 2026-09-29.

## Source quality

### Source A — Next Level / Mr Chu

- container: MP4
- video: H.264
- resolution: 910×512
- frame rate: 30 fps
- duration: 243.833 s
- estimated audio tempo: ~117.454 BPM
- preferred capture target: right-side player
- assessment: strongest source for motion extraction because one actor remains relatively isolated and fully visible for many turns.

### Source B — Korea Audition / Like U

- container: MP4
- video: H.264
- resolution: 682×512
- frame rate: 30 fps
- duration: 248.753 s
- estimated audio tempo: ~103.359 BPM
- assessment: useful choreography reference but more multi-person overlap, so lower priority for monocular mocap.

## Runtime invariant

The existing gameplay contract remains unchanged:

- one global turn = four beats;
- semantic choreography IDs remain `dance-01 ... dance-08`;
- Finish remains `finish-special`;
- additional visual variety must be presentation variants under those semantic IDs;
- WebAudio remains the authoritative clock;
- motion assets must never change score, command generation, turn budget, level duration, Finish semantics, or AUDIO END.

## High-confidence Normal candidates

| Source | Range | Semantic slot | Working label | Confidence |
| --- | --- | --- | --- | --- |
| A | 32.206–34.226 | dance-08 | arm-thrust + knee accent | High |
| A | 44.211–46.208 | dance-01 | side-step groove | High |
| A | 52.222–54.219 | dance-03 | cross-step footwork | High |
| A | 84.219–86.216 | dance-02 | upper-body arm-open phrase | Medium |
| A | 91.696–93.716 | dance-05 | kick + arm raise | High |
| A | 104.234–106.231 | dance-04 | hip / side sweep | Medium |
| A | 134.235–136.231 | dance-08 | wide power pose phrase | High |
| A | 174.219–176.216 | dance-04 | hip-step / twist | High |
| A | 182.230–184.227 | dance-02 | arm-up hop | High |
| A | 198.229–200.226 | dance-05 | kick / cross-step | High |
| A | 204.730–206.750 | dance-08 | arm sweep + back kick | High |

## Additional reference candidates

| Source | Range | Semantic slot | Working label | Confidence |
| --- | --- | --- | --- | --- |
| B | 56.285–58.584 | dance-01 | group side groove | Medium |
| B | 81.084–83.383 | dance-07 | low side lunge | Medium |
| B | 109.946–112.245 | dance-06 | turn + pose | Medium |
| B | 128.406–130.705 | dance-05 | leg-lift accent | Medium |
| B | 169.947–172.246 | dance-08 | power step | Medium |

Source B candidates are retained as choreography references. They should not be first-choice monocular mocap inputs because multiple dancers overlap.

## Finish candidates

### Source A continuous Finish sequence

- source range: 119.500–130.500
- role: `finish-special`
- contents:
  - upright preparation;
  - drop to floor;
  - floor-power / break-style transition;
  - inverted-leg phase;
  - recovery to standing.
- assessment: best current Finish capture source.

### Source B floor-power references

- 198.136–200.295 — floor-spin Finish phrase
- 200.295–202.524 — floor-power continuation

These are useful references but lower confidence for mocap because of group overlap.

## Mocap-ready preprocessing

Two single-subject-oriented crops were prepared outside the repository:

1. `audition_mocap_normal_A_15s.mp4`
   - Source A: 194.000–209.000
   - 15 seconds
   - right-side actor
   - multiple clean Normal phrases

2. `audition_mocap_finish_A_11s.mp4`
   - Source A: 119.500–130.500
   - 11 seconds
   - continuous Finish sequence

Combined duration: 26 seconds.

This intentionally fits inside a 30-second video-to-motion test budget and provides one Normal capture plus one Finish capture before spending time on lower-confidence group footage.

## Animation extraction plan

1. Generate 3D motion from the two mocap-ready crops.
2. Export a Mixamo/HIK-compatible FBX or BVH.
3. Inspect root motion, hips, shoulders, knees, feet and floor contact.
4. Remove unusable frames and smooth jitter without changing phrase timing.
5. Split the Normal capture into individual four-beat phrases.
6. Split/curate the Finish capture into bounded Finish variants.
7. Retarget onto the accepted Meshy rigs.
8. Test both male and female characters on iPhone.
9. Only accepted motions enter the published animation release.

Do not promote raw video-derived motion directly into production without deformation and foot-contact QA.
