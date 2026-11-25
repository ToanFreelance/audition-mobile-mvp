# Post-integration hotfix V1 — 2026-11-25

Baseline development daa5c14b3a019cdb4117b42e442422ef1d77fe16; PR #30 merged, PR #19 remains draft and untouched.

## A — Confirmation redirect

The owner observed a successful confirmation followed by a different deployment and a denied profile write, then successful creation and gameplay at the canonical development alias. Live Vercel metadata has no AUTH_REDIRECT_ORIGIN override and the server backend key is scoped to development. Both signup and resend use the same redirect helper. The previous helper could fall back to the inbound deployment origin when branch metadata was missing. This is a confirmed code risk, not proof of the historical redirect cause. The actual confirmation link destination, Supabase Site URL/allowlist/template and historical runtime metadata could not be independently verified with the available interfaces. No global Auth configuration or grants changed. Pin development preview to its approved stable branch alias; other previews require a configured or platform branch origin, and URL credentials/path/query/fragment are rejected. Unit regressions cover both provider requests and missing metadata. Actual email confirmation on iPhone is still required.

## B — Protected CI

Run 45564394374 job 139045300513 logs explicitly show an empty SUPABASE_SERVICE_ROLE_KEY before QA starts. GitHub documentation says a called job may use its own environment secret; lack of secrets: inherit is not a proven cause. Exact environment secret name and branch rules cannot be read through the available connector. Separate the trusted development push QA into the existing standalone workflow, retaining the environment, exact job ref guard and manual dispatch. Distinguish empty/unavailable vs malformed prefix without revealing values. No secret scope, HTTPS setup, test deadline, cleanup or artifact policy changed. This architectural choice removes the reusable invocation as a variable, not proof of the final cause. Protected run must pass after trusted deployment; do not authorize the hotfix branch automatically.

## C — Haunted Classroom

Latest run attempt 2, shard 4 job 139045257732: both attempts timed out performing a real click on 4 actors (10s), after visibility/enabled/stability checks; the original run reported 1 actor. Stage3D data-preview-actor-count is the React selection, not proof the asynchronous actor and visual clones have been applied. The test now waits for the real qaVisibleActors state before clicks and after each change, retains all 0–5 selection and camera assertions, adds aria-pressed, URL and elapsed diagnostics. Initial 60s allowance matches the existing core actor readiness allowance; click timeout and UI are unchanged. Renderer saturation versus input/clone latency is still unproven; if focused QA fails, investigate trace and timing rather than weaken assertions. Latest rerun also reports a separate flaky fallback smoke (96 passed, 1 failed, 1 flaky); not silently waived or changed. Full four-shard regression must pass.

No gameplay, M3 identity, RoomState, Supabase mutations, or stage visuals changed. Hotfix preview has no dedicated backend credentials at inspection; no development/QA keys reused. All new results pending CI and owner acceptance.
