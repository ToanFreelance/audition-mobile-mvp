# Audition Mobile MVP — Feature & Issue Trace Log

> **Living project tracker.** Update this single document whenever a feature, investigation, fix, QA gate, or branch status changes. This is a historical/audit index, **not** a substitute for the referenced source code, PR diff or actual test evidence.
>
> Updated: **2026-10-12**. Latest PR #18 HEAD verified at start of this log: `5ad07bb02c211641e5c782b0651dbbf369d42dd9`. This value is a **checkpoint**, not a permanently current HEAD.
>
> Repository: `ToanFreelance/audition-mobile-mvp`. Stable/integration branches: `main` / `development`. Never edit either directly or merge without owner approval.

## Update policy

Each future implementation/QA pass should append a dated entry under **History** and update affected feature/issue rows: feature ID, scope, branch/PR, what actually changed, evidence, remaining defects, status and next gate. Always distinguish **code committed**, **CI success**, **test executed**, **owner-accepted**, and **planned**. Record actual commit SHA when known; never turn a plan or skipped test into PASS. Do not store credentials, participant UUIDs, production-like data, or giant trace artifacts here; link to Library evidence/report by filename.

Statuses: `ACCEPTED` (owner/required gate accepted), `IMPLEMENTED / QA OPEN`, `PARTIAL PASS`, `OPEN DEFECT`, `PLANNED`, `DEFERRED`, `BLOCKED`.

## Feature index

| ID / Feature | Description | Working branch / PR | Work completed and evidence | Status / remaining gate |
|---|---|---|---|---|
| **P5.6 Waiting Room Visual V2** | Five-person mobile stage, crown/host hierarchy, approved reflective floor/lighting and actor lifecycle | historical `work/p5-6-waiting-room-visual-v2`, PR #15; integrated to `development` | Owner accepted P5.6; merge reported in `docs/PROJECT_INSTRUCTIONS.md` as `d271689`. PR #18 entry route now explicitly selects `visualPreset="sketch"` (`4b93c39`); owner iPhone screenshot confirmed reflective stage restored | **ACCEPTED visual baseline**. Do not redesign during integration QA |
| **MVP Entry / Room Browser** | Character creation → `/rooms` → CREATE/JOIN → real Waiting Room; portrait neon UI, fixed viewport, demo covers/0 coin/0 gem | `work/mvp-entry-room-flow-v1`, PR #18 (Draft) | Sketch UI commits `4564c20`, `84a5028`, scroll-only list `1d8f9d4`, visual restore/icon polish `4b93c39`; owner iPhone screenshots | **IMPLEMENTED / QA OPEN**; never treat demo cards as canonical rooms |
| **Multiplayer PRELOADING / CAS recovery** | Frozen content, LOADING advisory metadata, desired-state CAS ACK, single shared epoch | `work/mvp-entry-room-flow-v1`, PR #18 | RC01 and Astra hardening `3c884a5`; nonblocking LOADING `3892f47`; regression spec `b5619f1` | **PARTIAL PASS**. V3 5-Human 3/5 E2E, 4/4 frozen sessions ALL LOADED. Full 5/5 real-Supabase acceptance pending |
| **READY / Host START recovery** | Desired READY boolean, verified canonical host START eligibility | `work/mvp-entry-room-flow-v1`, PR #18 | Hardening in `3c884a5`; targeted local regressions reported by Work | **IMPLEMENTED / QA OPEN**; retain server CAS + READY gate |
| **RC02 Multiplayer provisional live scores** | Cumulative player-reported score snapshots over real Realtime; remote leaderboard | `work/mvp-entry-room-flow-v1`, PR #18 | Client-reported live scoreboard + prior Work 2/3/5 Human checks; score remains provisional | **IMPLEMENTED / SECURITY LIMITATION**. No authenticated anti-cheat/ranking |
| **P4.6 Gameplay Ensemble** | Show 2–5 genuine Human actors dancing simultaneously in Gameplay, each with participant-specific animation; portrait performance gate | **Future dedicated work branch, not created**. Roadmap `docs/PROJECT_ROADMAP.md` | Owner requested on 2026-10-12. Roadmap recorded in `5ad07bb`. Current Gameplay still renders only the local actor, while Waiting Room renders all | **PLANNED / DO NOT IMPLEMENT BEFORE PR #18 ACCEPTANCE** |
| **S2.5A Neon Stage V1** | Separate stage/environment content and visual-fidelity workflow | historical `work/s2-5a-neon-stage-v1` / PR #17 | Described in `docs/S2_5A_NEON_STAGE_V1.md`; current status not freshly verified in this PR #18 QA pass | **OUT OF SCOPE** for PR #18; no stage work here |
| **AUD01 Audio cross-client skew** | Real-hardware WebAudio synchronization and playback tolerance | Cross-cutting PR #18 QA | Cloud Chromium diagnostics have out-of-tolerance differences and resource contention; do not equate diagnostic residuals to measured speaker output | **OPEN / requires independent foreground iPhone devices**. Do not change scheduler or 50 ms acceptance threshold without proof |

## Issue / QA register

| ID | Observed symptom / evidence | Cause established? | Last handling | Next objective and acceptance |
|---|---|---|---|---|
| **QA-H01** | V3 two `preload-nonblocking-effect.spec.ts` failures caused by `Error` constructors from different VM realms | **Yes — harness** | `5ad07bb` passes host `Error` into sandbox | Run original Playwright spec; do not call PASS from source inspection alone |
| **QA-H02** | V3 two room viewport tests failed locating `footer` by implicit `contentinfo` within `main` | **Yes — harness** | `5ad07bb` targets labeled `footer` selector | Run original 390x620 and 390x740 Playwright viewport specs |
| **QA-JOIN-02 (Five-2)** | `demo-helpers.ts:97` timed out after 10 seconds waiting for a specific GET response. Canonical snapshot then contained 3/5 participants; GET was still pending | **No — waiter/transport boundary**, not established as application defect | Prior V3 Work ZIP includes a later modified QA helper that dropped the 10-second response waiter, but it has **no recorded successful rerun of that failed case** | Confirm both canonical membership and real browser Waiting Room/Ready UI within a bounded deadline; on failure report whether server mutation or UI handoff failed; no manual JOIN or false PASS |
| **QA-GAMEPLAY-04 (Five-4)** | `demo.spec.ts:17` DOM `multiplayer-gameplay-live` absent at assertion deadline 75s; canonical had 5 LOADED/epoch and failure screenshot later showed Gameplay | **Unresolved**: late DOM commit, render/event-loop pressure or genuine handoff bug | V3 evidence `PR18_FOCUSED_RETEST_V3_EVIDENCE.zip` | Capture per-client epoch, native source-start, audio clock, DOM mount timestamp and event-loop long tasks; report **late visible** separately from on-time PASS; no WebAudio changes |
| **INTEGRATION-01** | Earlier 5-Human PRELOADING stalled on LOADING metadata timeout | **Partially addressed** | Hardening and nonblocking loading; V3 run 4 recovered multiple metadata timeouts to 5 LOADED | Fresh 5/5 independent real-Supabase stress PASS |
| **AUD01** | Cross-client audio skew/residuals above threshold in cloud browser load | **Not established on independent hardware** | Measurement/report only | Run owner two-device foreground iPhone test; preserve clock architecture |

## Evidence and acceptance ledger

- Historical baseline: `PR18_SUPABASE_INTEGRATION_REPORT.md`, `PR18_SUPABASE_INTEGRATION_EVIDENCE.zip` (ChatGPT Library).
- **2026-10-12 V3 focused test:** `PR18_FOCUSED_RETEST_V3_REPORT.md`, `PR18_FOCUSED_RETEST_V3_EVIDENCE.zip` (ChatGPT Library). 2-Human PASS; 3-Human PASS; 5-Human full E2E **3/5** (runs 1,3,5 PASS; Five-2 JOIN waiter timeout; Five-4 gameplay DOM deadline). **4/4 frozen sessions** reached ALL LOADED. Class **B — FUNCTIONAL PARTIAL PASS**, not integration acceptance.
- Owner visual check: P5.6 `sketch` Waiting Room restored with reflective floor on iPhone; this is not evidence of 5-Human gameplay/clock integration acceptance.
- **Current branch rule:** PR #18 remains OPEN / Draft against `development`; never merge without owner approval.

## History (append-only chronology)

| Date | Feature / change | Branch / PR | Commit(s) | Validation actually performed / risk |
|---|---|---|---|---|
| 2026-10-11 | Astra canonical metadata hardening | `work/mvp-entry-room-flow-v1` / #18 | `3c884a5` | Work unit/regression + subsequent V3 integration; 5-Human still partial |
| 2026-10-12 | LOADING no longer blocks frozen asset preload | same | `3892f47`, `b5619f1` | CI build; V3 real Supabase preload improvement; original regression harness initially contained two errors |
| 2026-10-12 | Sketch mobile browser / scroll-only list / Waiting Room preset | same | `4564c20`, `84a5028`, `1d8f9d4`, `4b93c39` | Vercel READY; owner iPhone visual acceptance of reflective stage |
| 2026-10-12 | Correct VM `Error` and footer selector; record future 2–5 actor gameplay roadmap | same | `5ad07bb` | GitHub diff checked; original Playwright specs **not yet executed** in that session |
| 2026-10-12 | Establish central feature/issue trace log and next focused QA harness instrumentation | same | **See Git history for this file** | Code/QA execution status must be updated only after actual CI and test results |

## Reusable PR #18 QA harness contract (introduced in this follow-up)

Repository QA-only sources:

- `e2e/helpers/pr18-integration-qa.ts`: `waitForJoinConvergence`, `installGameplayHandoffDomProbe`, `waitForGameplayDom`, and `captureGameplayHandoffDiagnostics`.
- `e2e/pr18-integration-qa-waiters.spec.ts`: deterministic mocked-fixture verification of helper semantics; **not** a real-Supabase acceptance run.

**How the next Work QA should adopt these:** In its real-Supabase `qa-harness/demo-helpers.ts`, after clicking JOIN, call `waitForJoinConvergence` with the actual Playwright Page, actual participant ID, and `readCanonical(roomId,signal)` implemented using authenticated/allowed ordinary GET of the **real** room API with abortable fetch. This waits for both canonical Human membership and the Guest READY UI/route. Do not wait for one individual GET response event or resubmit JOIN blindly. Before `page.goto`, call `installGameplayHandoffDomProbe(page)`; when checking GAMEPLAY, call `waitForGameplayDom` and attach `captureGameplayHandoffDiagnostics` per client to test evidence on failure. Instrumentation timestamps are approximate browser observations, not an alternative WebAudio clock.

The Work V3 ZIP already contains a post-failure `demo-helpers.ts` variation with the 10-second response waiter removed, but **there is no successful Five-2 retest recorded for that variation**. These new repo helpers provide an auditable shared implementation; integration with the external Work harness and execution of the five-client test are **still PENDING**. If a helper test fails, fix its harness issue without altering production RoomState/CAS/WebAudio.

## Mandatory future QA decision rule

Never equate a green CI/build, a recovered metadata ACK, canonical `playing`, or a post-timeout screenshot with complete 5-Human E2E PASS. Confirm each browser's on-time GUI, frozen identity, single epoch/audio source, real gameplay progression and score convergence independently. Keep AUD01 separate. Reproduce true defects twice before any production change.
