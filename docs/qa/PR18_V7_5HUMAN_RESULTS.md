# PR #18 — V7 Five-Human Real-Supabase QA Report

**Executed:** 2026-10-13 (UTC)  
**Repo:** `ToanFreelance/audition-mobile-mvp`  
**Branch:** `work/mvp-entry-room-flow-v1` · PR #18 OPEN / Draft  
**Tested commit:** `bf7dc59bccb7b4d7dac34f5e5de4c11b3bb1dbdf` — Vercel preview SUCCESS  
**Change scope:** QA only. No production files modified, no merge, no force push.

## Acceptance verdict

**5 independent sessions attempted; 1/5 bounded core handoff PASS, 4/5 failed to reach 5/5 LOADED. Full V5-equivalent Final Acceptance: 0/5 PASS.**

Each session created one unique real Supabase room, five independent Human identities/browser contexts, used the actual character creation + JOIN/READY/START UI, and reached at least PRELOADING with 5/5 JOIN and 4/4 Guest READY. No manual RoomState mutation, fake ACK, forced LOADED, synthetic epoch, or gameplay override.

| Run | Room (deleted after test) | Final canonical | Human LOADED | Other load states | Verdict |
|---|---|---|---|---|---|
| V7-1 | `mvp-8b64f253-a2a` | PLAYING r19 | 5/5 | — | **Core handoff PASS** |
| V7-2 | `mvp-d2575c56-6c0` | PRELOADING r17 | 4/5 | G3 LOADING | FAIL |
| V7-3 | `mvp-59be7801-381` | PRELOADING r17 | 2/5 | G1, G2, G4 FAILED | FAIL |
| V7-4 | `mvp-cf70b77c-c18` | PRELOADING r16 | 4/5 | Host IDLE | FAIL |
| V7-5 | `mvp-6ec63dca-50f` | PRELOADING r18 | 4/5 | G2 FAILED | FAIL |

## Environment and methodology

V7 used the exact public GitHub HEAD, protected branch Vercel preview, real Supabase Room API/CAS and Realtime, Playwright 1.62.1 and Chromium 151. It reused repository QA helper ideas and V5 evidence, but the runner itself was a temporary sandbox script, not a committed test suite. Five mobile portrait browser contexts were split across separate 4-vCPU/8-GiB Vercel Sandboxes: V7-1/2 used **2+2+1**, V7-3/4/5 used **2+1+1+1**.

Each client was checked for real canonical JOIN plus Waiting Room READY UI; each Guest READY was confirmed by canonical snapshot. Host START was actually clicked. The runner observed canonical PRELOADING, LOADED/FAILED, PLAYING, Gameplay DOM, HTTP request timings/abort errors, Realtime hints, and long `AudioBufferSourceNode.start` calls.

**Limits:** For Gameplay DOM, V7 waited up to 75 seconds *after canonical PLAYING*, whereas original V5 required 75 seconds from the **Host START click**. V7 did **not** execute complete five-client score-input/receipt convergence or AUD01 hardware speaker/clock-skew measurements. Consequently V7-1 is a **bounded core path PASS**, never a full Final Acceptance or proof of physical audio synchronization.

## V7-1 — Bounded core PASS

Canonical 5/5 JOIN; all 4 Guests READY; Host START; PRELOADING r11; ALL LOADED r18; PLAYING r19, shared epoch **1791861860384**. All five browser DOMs displayed Gameplay and all five client instruments recorded **one** long music-buffer start (duration >=60s). This confirms the five-browser handoff path works at least once; it does not validate multi-client output speaker skew or score convergence. Early animation GET aborts were recoverable in this successful run.

## V7-2 — One LOADING indefinitely

Canonical PRELOADING r17 with G3 LOADING and all other four LOADED. A G3 animation GET was observed around **7.96s** in browser telemetry, near the existing 8s release-loader timeout. A slow request is a diagnostic lead, not a proven sole cause of the missing LOADED ACK. The runner's all-loaded deadline expired.

## V7-3 — Three content preload failures

PRELOADING r17 with **2 LOADED / 3 FAILED** despite isolated Guest sandboxes. Browser console/UI and fetch instrumentation showed `CONTENT PRELOAD FAILED · Frozen animation release no longer matches the MatchManifest.`; one animation GET aborted after ~**9.33s**, another after ~**5.70s**, and `preload-failed` requests reached the server. This is a real content transport and preload integration failure, not merely a five-scene browser resource timeout.

## V7-4 — Host preload state did not advance

PRELOADING r16, **4 Guests LOADED; Host IDLE**. Host browser issued `preload-loading` POST requests with HTTP 200, but canonical Host loadState remained IDLE. HTTP 200 is not proof that a server CAS mutation was applied. Capture the response body's `applied`, `conflict`, revision and participant identity, then trace Host preload retry/reconciliation before changing production behavior. Root cause remains open.

## V7-5 — Deterministic 8,000ms abort reproduction

PRELOADING r18, **4 LOADED / G2 FAILED**. G2 animation GET was aborted at **8,000ms**, the fallback request aborted immediately with the already-aborted signal; on-screen frozen release mismatch appeared and multiple `preload-failed` calls were observed. This directly reproduces the V5 content transport failure pattern.

## Code-level root cause to address next (not implemented during QA)

`components/character/published-animation-library.ts` creates **one** 8s `AbortController` for manifest GET, versioned bundle fetch and fallback to legacy bundle. On timeout, the legacy fallback can reuse an already-aborted signal, so `loadPublishedDanceRelease()` returns `null`. `components/multiplayer/lobby-match-content.ts` then computes animation release version **0** for null, and `assertFrozenContent()` compares it with the frozen positive manifest release, emitting a misleading **identity mismatch** when the underlying failure was availability/timeout. Genuine identity mismatch must still fail strictly.

A focused follow-up should load the **exact frozen release version**, use separately bounded request signals and safe retry instead of sharing an aborted controller, and distinguish unavailable content from true version/hash disagreement. Do not bypass frozen MatchManifest validation, magic-offset the epoch, or change WebAudio/gauge/timeline.

Separately investigate Host preload status/ACK retry from V7-4 with authoritative CAS `applied/conflict` evidence before patching it.

## Cleanup

All five generated QA rooms were verified to have exactly five test-owned Human participants and only matching leases before deletion. Guarded SQL deleted **5 QA rooms and 25 QA leases**; post-check returned **0** test rooms/leases. **471 unrelated rooms remained unchanged**, fingerprint `1ce98616e38058f72d9172b37749cf48`.

## Remaining gates

- Focused content release transport/preload fix, with deterministic abort+retry tests.
- Host IDLE preload/revision and CAS ACK root-cause verification.
- New full 5-Human independent acceptance that preserves the original V5 Host-click Gameplay deadline, WebAudio scheduling invariants and score convergence.
- AUD01 physical foreground iPhone audio verification; PR #18 remains Draft/unmerged, P4.6 remains PLANNED.

This report summarizes measured canonical state and browser instrumentation; full individual browser trace archives were not exported from temporary sandboxes and must not be claimed.
