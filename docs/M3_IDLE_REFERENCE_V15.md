# M3 Waiting Room V1.5 — Reference-authored idle clips

Date: 2026-11-15
Branch: work/m3-waiting-room-integration-v1
Status: Technical QA candidate; physical iPhone visual acceptance OPEN.

## Primary user source

Owner-supplied Zenless Zone Zero idle compilation: YTDown.com_YouTube_Media_9uaKR_GiZQs_All-Character-Idle-Animations-Zenless-Beta_002_1080p(1).mp4 (910×512, 30 FPS, 147.07 s). Inspected the female character around 37–44 s and the sleepy male around 78–88 s at approximately 0.5–0.75 s intervals. These are **rendered images**, not original bone, curve, physics or facial animation data.

## Frame-guided motion mapping

| Reference timestamp | Reference observation | Newly authored M3 timeline |
|---|---|---|
| Female 37–38.5 s | Wide planted stance, knees flexed, alternating fists low/chest | 0–1.47 s, alternating hip shift, crouch, left/right lower guard |
| Female 39–40.5 s | Fists rise near face, elbows open, upper torso straightens | 1.90–3.35 s, two-arm inverse-kinematic guard targets near cheeks |
| Female 41–42 s | Lower squat/brace, upper-body counter-turn | 3.84–4.90 s, alternating guard/crouch |
| Female 42–44 s | Ready stance and lateral body shift | 5.43–7.40 s, held side guards, loop returns to first pose |
| Male 78–79.5 s | Stands normally, begins to nod forward | 0–1.28 s, head/neck/spine start to bow |
| Male 80–87 s | Long sleepy head-down hold, shoulders slumped | 1.96–8.25 s, sustained tilted posture with subtle variations |
| Male 87–88 s | Wakes up and straightens | 8.70–10.10 s, head-up / shoulder rebound and settle |

Video similarity approach: manually author an M3-compatible **THREE.AnimationClip** for each selected motion. Each sampled reference beat maps to explicit pelvis position, spine, neck, head, upper-arm, forearm and wrist quaternion keyframes. Female M3 additionally animates available finger bones into a guarded hand. Linear interpolation of wrist/arm endpoints is avoided by first baking two-bone arm poses at each keyframe. Three.js then interpolates the resulting quaternion tracks.

## Architecture and safety

- Profile selection is explicit from the Character Catalog's m3RigFamily (drophunter or neurohacker); never inferred from a name, appearance text or participant gender label.
- Each participant's own SkeletonUtils clone owns one AnimationMixer action. It is created only with the actor, updated by the existing Waiting Room 30 FPS loop and uncached on true departure or actor replacement. READY/connection metadata updates do not restart it.
- Preserve V1.4 planted-foot locking by running leg IK **after** the animation mixer each frame. The reference female's wider stance is authored once through actor-local contact anchors, not recreated by foot sliding or root motion.
- The visual QA sketch route exposes the chosen reference profile, clip time, active gesture and sampled foot drift through DOM dataset attributes. No gameplay or production HUD is added.
- M3 continues to be Waiting Room-only (lobbyReady=true, runtimeReady=false). START/preload and gameplay remain blocked.
- WebAudio remains the authoritative gameplay clock. RoomState CAS, Supabase Realtime, stage catalog, Finish and gauge are untouched.

## What is and is not equivalent to the video

The result aims to reproduce **recognisable pose sequence, duration, and physical rhythm** on different M3 bodies. It is NOT a pixel-perfect recreation or animation data extraction: the source game's models, custom face rigs, clothing, physics, keyframe curves and VFX are unavailable, and M3 silhouettes and joint limits differ. No source game asset, animation clip, skin or texture is copied. An exact performance would require authorized source animation data or dedicated video-to-pose recovery plus artist retargeting and iPhone visual review.

## Acceptance gates

- Next.js production build, TypeScript and focussed Playwright compatibility/animation tests.
- Browser/SwiftShader checks: actual M3 female and male rigs, 5-person mixed Waiting Room, foot drift, actor lifetime and absence of runtime errors.
- Owner iPhone: no skating, arms read as raised guard rather than salute/T-pose, male visibly sleeps and wakes, garments do not clip, five-person composition remains coherent.

Do not merge into development/main without explicit approval.
