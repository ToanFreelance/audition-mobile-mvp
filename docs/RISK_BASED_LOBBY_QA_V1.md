# Risk-Based Lobby QA V1 — pilot

Owner approved 2026-11-26. Separate CI-only work branch; no runtime architecture changes.

- Work push: only an existing RoomBrowser.module.css modification (optionally with docs Markdown) can use visual scope. The job checks the patch and self-tests the router without npm setup; Vercel build and an actual Room Browser visual smoke remain pending until observed.
- All other paths, unknown history, new branch events, mixed runtime changes, deleted or renamed CSS, and non-work events fail closed to the existing full fast checks. Docs-only changes do not normally trigger this workflow.
- Pull requests to development retain TypeScript, ESLint, both existing focused suites, static-build and four-shard core-regression. Development/main checks and protected Auth workflows unchanged. Required check names unchanged.
- The first CI run on this CI-change branch must use full fast validation. Test the router's visual path using the real Git fixture in the self-test. Do not assert measured CI latency before observing a real visual-only push.
- No merge without owner approval. Review Vercel/build and visual acceptance separately. Expand the allowlist only after evidence supports it.
