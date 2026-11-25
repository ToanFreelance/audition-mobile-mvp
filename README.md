# Audition Mobile MVP

Mobile-first 3D dance/rhythm game prototype inspired by classic dance games. Existing project only; not a copy of proprietary source code, networking protocol or assets. Internal demo assets still require rights review before public distribution.

## Current status — 2026-11-25

| Area | Status |
| --- | --- |
| Development integration PR #30 | MERGED — `daa5c14b3a019cdb4117b42e442422ef1d77fe16` |
| Main / production | unchanged — `7e9e9d64c05a54e7c167aa68e048153082973908` |
| Physical iPhone account registration, real verify, match START | Owner PASS on development, 2026-11-25 19:17 ICT |
| Account Auth / signed Guest / Admin QA / M3 wardrobe and persistence / P5.7 | Integrated |
| Post-integration hotfix | [PR #31](https://github.com/ToanFreelance/audition-mobile-mvp/pull/31) OPEN/Draft; A owner PASS, B/C CI open |
| Dance Animation V2 | [PR #19](https://github.com/ToanFreelance/audition-mobile-mvp/pull/19) OPEN/Draft, deferred until hotfix acceptance |

**Canonical development:** [Open game / Auth](https://audition-mobile-mvp-git-development-toan-freelances-projects.vercel.app/auth). Do not use old Account Email Auth preview or deployment-hash URLs for normal QA. Hotfix preview requires separate backend credentials for full server-side QA.

## Stack and runtime

- Next.js App Router, React, TypeScript (Node.js 22 in CI; use lockfile).
- Three.js / WebGL2 Stage3D and character animation; M3 modular characters and wardrobe; Character Catalog resolves runtime actor identity.
- Web Audio API is the authoritative audio/gameplay clock.
- Supabase Auth, Postgres / RLS, Storage and Realtime; server-authoritative RoomState and CAS mutations.
- Vercel Git previews; GitHub Actions and Playwright QA.

## Local development

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Use only authorized development/test environment configuration. Public Supabase URL and publishable key are required for connected features. Server-only `SUPABASE_SERVICE_ROLE_KEY` and `ROOM_GUEST_SESSION_SECRET` are required for hardened writes/guest flow; obtain dedicated authorized credentials, never commit them or expose via NEXT_PUBLIC. Email confirmation requires the exact trusted /auth redirect in Supabase allowlist and configured SMTP. Do not reuse production/QA secrets for new preview branches.

## Architecture

```text
app/                 Next.js pages and server API routes
components/          Stage3D, UI, character catalog/runtime and room presentation
game/                Rhythm rules, scheduling and scoring
multiplayer/         RoomState / CAS, manifest and synchronized start
lib/                 Server auth, storage and session utilities
supabase/            Database migrations and security boundaries
e2e/                 Playwright regression and real QA
docs/                Architecture, decisions, roadmap, trace and QA evidence
```

Locked invariants: four beats per global turn; player penalties never alter the global timeline; gauge calibration locked; Finish is Level 9 special command, only audio end ends gameplay. Preserve server authority, frozen match manifest, Ready/START gates and shared epoch. Never infer actor rig from player names or gender heuristics.

## Controls

Desktop: arrow keys (or W/A/S/D), Space for judgement. Mobile: on-screen direction and action controls.

## Validation and branch policy

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run test:qa:lobby:fast
# Start a local test server or set PLAYWRIGHT_WEB_SERVER=1 after build:
PLAYWRIGHT_WEB_SERVER=1 npm run test:qa:core
```

Core CI uses four shards and fails on flakes; privileged real Auth/signed Guest duo QA only on exact trusted refs with the protected security-auth-qa environment. No secrets on pull_request. Wave 3 pre-merge 392 passed/2 existing skips; latest development CI not green. Two external C1 fixture skips, five-human, WebKit and broader real-device qualification remain open.

Work only on dedicated work branches; development is integration/final test, main stable/production. No automatic merge or deployment promotion. Phase 14 resolution/fidelity deferred.

## Project records

- [Current project instructions](docs/PROJECT_INSTRUCTIONS.md)
- [Roadmap](docs/PROJECT_ROADMAP.md)
- [Feature and issue trace log](docs/FEATURE_TRACE_LOG.md)
- [Security/Auth closeout](docs/SECURITY_AUTH_CLOSEOUT.md)
- [Post-integration hotfix RCA and evidence](docs/POST_INTEGRATION_HOTFIX_V1.md)
- [P5.7 Seamless Match Start](docs/P57_SEAMLESS_MATCH_START.md)

Latest checkpoint entries supersede historical active-work labels. Keep exact SHA/run IDs, real validation and owner acceptance evidence in trace log. Never include credentials or personal account details.
