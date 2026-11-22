# Auth V1 — email/password + one character per account

Work branch: `work/account-email-auth-v1`
Baseline development HEAD: `beaaa8a3caf46543df23513a0aaab829d929e23a`

## Scope
- Supabase Auth GoTrue REST email/password signup, sign in, sign out and email confirmation callback.
- HttpOnly SameSite=Lax secure cookies. Access/refresh tokens are not placed in localStorage.
- GET /api/auth verifies identity with Supabase; refreshes expired sessions and rotates cookies.
- Owner-scoped `player_characters` with PK `user_id` referencing `auth.users`, RLS, server-side profile validation and optimistic revision guard.
- Exactly one M3 character row per account. Asset identity is immutable after first save; same character may change hair/skin/outfit/name.
- Existing guest MVP is retained temporarily for QA; legacy local drafts are NEVER silently claimed by a newly authenticated user.
- No change to WebAudio, gameplay timeline/gauge, RoomState CAS, Realtime, actor lifecycle or START gate. M3 still runtimeReady=false.

## Email confirmation
Supabase's Confirm Email setting is respected. When enabled, registration returns pending, and default implicit confirmation link redirects with fragment tokens. For branch Preview URLs, allowlist `https://<stable-branch-host>/auth` in Authentication > URL Configuration (or use the appropriate wildcard). Do not disable confirmation automatically. No emails/passwords are logged.

## Safety and remaining integration
- This is temporary Auth V1, not a production-grade account/social/economy system. Add recovery, MFA, abuse protection, account deletion, comprehensive role auditing later.
- Existing Room API still uses legacy client participant ID for the guest-first protocol, and cannot be considered fully account-authoritative until a dedicated Room CAS/auth migration. Do not represent gameplay or RoomState as secure account ownership yet.
- Auth can operate even when profile table is not yet deployed; profile save requires the accompanying additive migration.
- Browser HTTP cache for shared immutable 3D assets is separate from per-user character data. No cross-account profile localStorage sharing.
- User's email confirmation delivery depends on Supabase provider settings and mail quota; test with a real address on Preview.

## Acceptance (iPhone)
- Signup/email confirmation per configured provider -> login/logout.
- Same account on two devices retrieves exactly one M3 profile; edit on A then refresh B sees latest revision.
- Account B sees no profile from A, even on shared device/after logout.
- Legacy guest Room/Waiting Room remains runnable in QA and accepted visual remains unchanged.
- Supabase policies block read/write to other users' records; duplicate insert blocked by PK.
