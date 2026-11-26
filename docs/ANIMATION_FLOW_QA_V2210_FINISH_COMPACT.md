# Animation Flow V2.2.10 — Longer 85_04 Finish and iPhone Compact Preview Controls

Repository: ToanFreelance/audition-mobile-mvp
Work branch: work/animation-flow-qa-v2 | PR #19 Draft/unmerged
Base SHA: 65943ec4197198e118fe43d043a20864bca32ce5

## Owner footage and defects

Owner uploaded an 11.1-second portrait iPhone screen recording on 2026-10-21. The footage visibly shows needing to scroll several viewport lengths from Finish selector to the animated stage, then back to controls, which makes repeated tests cumbersome. The Finish currently plays the arbitrary 85_04 excerpt 0.2–4.2 source seconds (4 seconds / 8 beats at reference 120) and then FinishPresentation switches to .5-beat pose hold, recover-narrow and idle. Thus the source-performance phase is short independent of the available Finish→L6 REST window. The video covers selecting/replaying the Finish, not a complete 20-beat cycle, so it cannot alone validate the motion seam or recovery.

## Targeted fixes

**Motion:** Add pure QA source-inspection module `lib/animation-flow-v2/fancy-finish-window.ts`. At lazy load of 85_04, sample animated BVH skeleton (head, hands and feet relative to hip), compute native motion-energy and planted-ish boundary pose, and rank CONTIGUOUS long performance windows from the complete take rather than the fixed 4-second front slice. Candidate length capped at 7.8 source seconds and by the real Finish→L6 global REST budget **from the shared GameplayPreview manifest** minus four reserved beats. Only attempt prepared clips whose full authored source root travel is stage-compatible; no teleport, time stretch, magic turn addition, loop or forced acceptance. If no viable source interval, show error and keep previous Finish; do not silently report success. The preexisting FinishPresentation still performs hold → recover-narrow → living idle; Flare remains default, unchanged. This is not a production/owner-approved motion cut: some source footage may contain long idle or a flip, and ground contact/root-facing need actual iPhone QA.

**Controls:** Quick control dock sits IMMEDIATELY next to gameplay stage with one Finish picker, BPM picker, “Xem Finish” replay, “Bắt đầu/Tạm dừng”, “Lượt mới” and “+ Breakdance”. Finish source interval and accepted/played Breakdance counts displayed next to preview. Avoid duplicated lower Finish selector. CSS trims mobile header/canvas/spacing. Crossfade/exit, detailed Breakdance diagnostics, legacy Catalog and old fixtures are in collapsible `details` panels, still accessible but not blocking first screen. The separate Dance Catalog review route remains functionally unchanged; all data-testid hooks for existing UI preserved or moved to dock.

## Locked architecture / safety

No new/moved global turn; WebAudio clock remains authoritative, 4 beats each; hidden/reveal/miss/penalty consume existing budget. No changes to Flare state machine, gauge, RoomState/CAS, Supabase, accepted Character Catalog, stages, production gameplay or `development`/`main`. No PR merge.

## Required validation

- Confirm TypeScript and Next.js commit-matched Vercel build. Build passing is NOT equivalent to successful motion preview/Playwright/iPhone visual pass.
- Unit regression with synthetic moving BVH must select a Finish longer than 6 seconds, respecting 7.8-second and REST-derived upper bounds. Browser smoke at 390px width verifies near-stage Finish selection, playback controls, BPM, Breakdance load access and collapsed advanced settings.
- On owner iPhone: select Fancy Footwork 85_04 in the near-preview picker; the nearby label must show selected source time range (ideally 6–7.8 seconds if source and placement allow). Tap Xem Finish and watch the WHOLE selected performance, the recovery and gentle living idle. Also verify real Gameplay Auto Perfect Finish at Level 5 / Level 9, REST and L6, and compare with default Flare.
- Potential rejection cases: source lacks planted boundary or long scene; path/facing not compatible; time budget is too small for 7.8 seconds. Do not bypass these checks.
