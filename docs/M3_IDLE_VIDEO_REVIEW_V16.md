# M3 Waiting Room Idle V1.6 — Owner selection-video reconstruction (provisional)

Date: 2026-11-16
Branch: `work/m3-waiting-room-integration-v1`
Status: **ENGINEERING CANDIDATE — V1.5 REJECTED; V1.6 physical iPhone visual approval NOT RECEIVED.**

## Source provenance / discrepancy resolved

The V1.6 request names `Video-test(20261116-030955).mp4`, but the newly supplied accessible upload is `Video-test(20261116-031643).mp4`. **The available upload itself was inspected** (89.233 seconds, 910×512 pixels, 30 FPS). Its nine visual regions match the owner's listed character groups. It is a compressed screen-recording of rendered characters — not 3D skeleton tracks, camera calibration or copyright-cleared motion capture.

The ~0–11 s female and ~54–65 s male were inspected as 1-second enlarged character crops. Other candidate intervals were reviewed in 2-second and/or key-pose contact sheets. Segment boundaries are approximate because fades, moves and character changes overlap. The exact source-video cycles cannot be established from one cropped camera view; V1.6 uses source-time-inspired loop closure.

## Source motion selection matrix

| Source time (approx.) | Observed key silhouette / motion | Intended rig | Dependency | Required joints | Complexity | Collision risk | Five-player use |
|---|---|---|---|---|---|---|---|
| **00–10.5 s** | Pink-haired female: hip-weighted relaxed stance; head/body turn; opens one palm near shoulder then lowers to rest | **M3 Drophunter — SELECTED** | Hand carries a rectangular bag in reference, but greeting arm can work empty-handed | pelvis, spine, neck/head, clavicle/arms/elbow/wrist/fingers, IK legs | Medium | Medium: elbow near bust, hips/garment | **Good** — readable without major stepping |
| 12–25.5 s | Light-haired woman: broad grounded stance, small head/body settling; long object across waist | Drophunter backup | Prominent held weapon | pelvis, neck/head, shoulders/elbows/wrists, legs | Low–medium | Medium: empty-handed prop-support silhouette | Good after wrist redesign |
| 25.5–33 s | Red outfit: wide, energetic fighting stance, elbows/chest movement | Drophunter later | Some gestures relate to equipment | hip/knee/ankle, spine/head, both arms | Medium–high | High: thigh and hand crossings | Moderate, more visually busy |
| 33–43 s | Green-haired light outfit: two raised hand/guard accents with bent knees and upper-body re-centering | Drophunter later | Large held weapon/prop | hips, both arms, spine, head, both legs IK | High | High: chest/arm, dress | Moderate |
| 43–53.5 s | Dark-haired woman: contained hand/torso gestures; upper-body/head turns; overhead glowing effect | Drophunter later | Effect/object present, body motion transferable | head/neck, spine, arm/wrist, hips | Medium | Medium: sleeves and weapon strap | Good after prop removal |
| **54–65.5 s** | Dark-haired male with wide pants: head/chest dip, long subdued hold, then neck-led lift; feet remain grounded in sampled views | **M3 Neurohacker — SELECTED** | Weapon strapped/backpack-like accessories, not needed for head motion | pelvis, spine, neck/head, shoulders/elbows/wrists, IK legs | Medium | **High in V1.5** if torso bends and arms are just Euler-spun | **Good** when clearance is enforced |
| 65.5–73 s | Large-bodied character: high arm/shoulder/equipment motion and heavy stance | Neurohacker later | Large shoulder equipment | hips/spine, shoulder/elbow/wrist, head, contact legs | High | High due to disproportionate upper-body mass | Low for current rig |
| 73–83.5 s | Equipment-bearing character: primarily three-quarter/back-to-camera changes, casual standing | Neurohacker later | Significant equipment and partly occluded hands | spine, shoulders/arms, hips, head | Medium–high | High: source occlusion, prop grasp | Moderate, after retarget review |
| 83.5–89.2 s | Male in formal jacket: fingertip gesture with one leg raised/bent and asymmetric weight | Neurohacker later | No essential hand prop, but free-leg posture essential | whole body + single-leg IK and one-foot balance | **High** | High: one-foot load, balance, sleeve/vest | Good *if* actual one-foot contact solver is implemented |

**Observed vs inferred:** The forward-facing image confirms key silhouettes and timing trends, but not exact joint rotations, depth coordinates, force distribution, obscured wrist trajectories or shoe-ground collision. No numerical 3D-pose reconstruction accuracy can be claimed from this MP4.

## V1.5 failure investigation

1. Female V1.5 chose the older 147-second compilation's 37–44-second defensive guard. It is not the selected 89-second video's pink-haired greeting, and its wide boxing/crouching mechanics conflict with this new reference.
2. V1.5 solved arm IK only at sparse discrete key poses, then quaternion-interpolated arms between endpoints without continuously monitoring forearm/torso clearance. An apparently valid endpoint can produce an intersecting elbow halfway through.
3. Male V1.5 added spine + neck + head flexion while rotating upper arms and forearms by fixed local Euler offsets, regardless of the torso's movement and each rig's clothed shape. This can fold hands through the torso/clothing, especially during the long slumped hold.
4. V1.4 foot correction solved separate planted ankle targets after hip motion; this mechanism was accepted and is retained. A working foot constraint does **not** imply a beautiful full-body performance.

## Methods compared and selected

| Approach | Availability / limits | Decision |
|---|---|---|
| Import source game skeleton/animation | Not supplied and would introduce proprietary assets | **Do not use** |
| Video-to-3D pose recovery | 910×512 single-camera rendered MP4, occlusion, costume and prop confounds; no validated 3D pose solver or calibration in current toolchain | Not claimed as automatic/exact |
| Blender hand-key and rig-retarget workflow | Technically useful for professional motion polishing, but Blender and authorized rig-linked assets were not available in this execution environment | Future optional art pass |
| **Source-timed manual body pose + continuous 30Hz IK sampling into THREE.AnimationClip** | Reuses verified M3 bone map and Waiting Room actor-owned AnimationMixer, no new runtime stack | **Implemented as provisional V1.6 engineering solution** |

## Implemented two performances

### Female, source 00–10.5 s → clip 10.40 s

- 0–2.9 s: held asymmetric hip stance / relaxed arms and slight head tilt.
- 3–4.75 s: weight shifts and the free right hand reaches up with an **open palm**, with head/body pre-turn.
- 4.75–7.18 s: hand remains raised near shoulder level, gentle wrist redirection; no invisible weapon grip.
- 7.75–9.4 s: arm returns to the resting position and head/hips settle; closing frame matches first frame.

### Male, source 54–65.5 s → clip 10.20 s

- 0–1.85 s: controlled head/neck drop, with reduced thoracic bend versus V1.5.
- 1.85–7.45 s: deliberate prolonged subdued pose, arms hang on *their own sides* in an anatomical IK solve.
- 8.08–9.45 s: upward head recovery with small overshoot, returning to exact rest loop pose.
- No root travel, no compensatory foot skating.

Both rigs use source-timed explicit control poses and eased holds. At clip bake each **30 FPS sample** solves shoulders–elbows–wrists from the final posed torso/head position, with a side-aware elbow pole and a shoulder-width-based torso clearance capsule. Failed geometric proxy checks restore the neutral arm rather than baking a knowingly intersecting key. This is **skeleton/capsule-level** mitigation, not a guarantee of mesh-cloth clearance: real skinned garment surfaces and intermediate blending must still be inspected.

The existing per-participant SkeletonUtils clone, mixer lifetime, deterministic phase stagger, and post-mixer V1.4 foot constraints remain. No RoomState, CAS, Realtime, READY, START, preload, shared epoch, WebAudio, gauge, Finish, gameplay animation, Character Catalog capability or stage formation protocol was changed.

## Evidence and acceptance gates

Source key-pose contact sheets were generated from the **new uploaded 89-second file** at 1-second spacing (female 0–11 s; male 55–66 s), along with intermediate references. These sheets do not prove M3 fidelity and should not be substituted for rendered comparison.

Expected technical checks: `npx tsc --noEmit`, `npm run build`, focused `e2e/m3-lobby-idle-v13.spec.ts`, female/male/five-person browser smoke and actor lifecycle/READY stability. A new synthetic-skeleton test checks forearm-to-torso proxy clearance over both full clips, in addition to foot contact.

**Not yet verified:** side-by-side source/M3 rendered key poses, male garment intersection in front/side projection, physical iPhone smoothness, five-person aesthetic fit and any final owner visual acceptance. These require actual runtime render captures and owner iPhone review before declaring PASS. This document is not a full QA certificate.

No merge to `development` or `main`.

## Actual V1.6 execution — 2026-11-16

### Source- vs rendered-frame review

The attached source video (the *actual* 031643 file) was sampled directly; key positions from the selected 00–10.5 s female and ~54–65.5 s male were compared against the real, assembled Drophunter and Neurohacker rendered in headless Chromium's existing sketch Waiting Room scene. The M3 image captures are **not frame-perfect time-synchronized or camera-aligned** to the original game; source timing labels are approximate, and the original and M3 outfits and body proportions are very different.

- The first actual V1.6 female capture revealed a wrong camera-side gesture (hand near **hair**), with both resting hands too close to the front hips: clearly not faithful to the source's viewer-right open palm / one relaxed arm.
- Correction at `5624a653ba5e7f133f6f9f8f514695940a49baa2`: mapped source viewer-right gesture to the proper M3 hand, moved the open palm outside the shoulder, and separated the resting hands.
- Correction at `c42b8df6977d121ac064e0cb9a4163d5d926584d`: resolved overly flared elbows during the resting pose. The source's bag-side arm now hangs lower and the other hand rests near the hip. The raised hand remains open, with no invisible-prop grasp.
- In the final headless front capture, there is no obvious forearm-through-chest artifact for the male, and the female's open palm is visibly **outside the torso**. However, the male's prolonged slump still hides most facial expression, the M3 gloves/hand silhouettes differ, the female's hand path and body-weight character are only partially similar, and the 5-person view sometimes has off-edge participants because of the accepted stage framing. **This is an improvement over V1.5, not equivalent to source quality.**
- Physical iPhone animation beauty, smoothness, clothing-body collisions at all intermediate frames, rear/side-view arm clearance, accurate shoe-ground geometry and naturalness **remain unverified**. Browser front snapshots plus torso capsule proxies cannot prove those gates. The owner's visual approval remains OPEN.

### Validation actually run

- Branch test code HEAD: `c42b8df6977d121ac064e0cb9a4163d5d926584d`.
- **Focused GitHub Actions PASS**: run [43800671170](https://github.com/ToanFreelance/audition-mobile-mvp/actions/runs/43800671170), job `m3-v16-focused`; TypeScript `npx tsc --noEmit` PASS; Next.js `npm run build` PASS; Chromium installation PASS; **8/8 focused Playwright tests PASS** (five synthetic-skeleton cases including transformed planted feet, looping and arm-clearance proxy; three actual assembled M3 render fixtures).
- Real render fixture `?m3=female`: stage ready, 1 actor/1 M3, 1 scene generation, `footDrift=0`, no pageerror, screenshots captured.
- Real render fixture `?m3=male`: stage ready, 1 actor/1 M3, 1 scene generation, `footDrift=0`, no pageerror, screenshots captured.
- Real render fixture `?m3=five`: stage ready, 5 actors (3 M3 + 2 C1/C4), 1 scene generation, `footDrift=0`, no pageerror, screenshots captured.
- Browser screenshot artifact: `m3-idle-v16-visual-43800671170` (artifact ID `14196317634`). Six full viewport PNGs and JUnit are included. Preview was READY at the stable git-branch alias after the code commit. This is a **software-rendered Chromium** result, not iPhone GPU or physical tap/reconnect evidence.
- The legacy general `Lobby QA QC` job on this work branch remains **FAIL** due to an unrelated pre-existing `@typescript-eslint/no-use-before-define` at `WaitingRoomStage3D.tsx:1868,1874` (`reconcileParticipants`). The same lint failure existed at V1.5 HEAD `a6a600a6...`. The dedicated animation QA tests/build PASS do not magically clear that gate.
- No real five-human Supabase READY/connection E2E was run; unchanged Stage3D runtime lifetime is supported by source inspection and the single-scene fixture, but not a claim of real reconnect/READY PASS.
- M3 remains Waiting Room-only with `runtimeReady=false`; no edits to RoomState, CAS, Realtime, START/preload, shared start, gameplay/WebAudio, gauge or Finish. No PR merge.

