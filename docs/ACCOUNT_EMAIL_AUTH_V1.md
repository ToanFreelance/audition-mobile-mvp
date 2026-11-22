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

## Auth V1 iPhone corrections — 22 Nov 2026

Owner screenshots identified three UI defects:
- Character Creator's centered `TÀI KHOẢN` badge obscured the head. Replace with a compact account icon alongside the existing dice control in the **upper-right**. Keep the accepted preview/layout otherwise unchanged.
- When editing the character name, iOS `visualViewport.height` contracts for the software keyboard. While the name input is focused, temporarily hide the large M3 options panel, title, navigation rail and save CTA. Maintain a usable 3D region and show name input directly above the keyboard; all controls return on blur.
- Room Browser avatar incorrectly linked to `/character/create`. The future destination is the Account Dashboard, which is not implemented yet. Pressing avatar now displays a short `Dashboard coming soon` message; it **does not navigate**.

### Email confirmation redirect — external Supabase setting required

Code now uses the stable Vercel `VERCEL_BRANCH_URL`, or optionally `AUTH_REDIRECT_ORIGIN`, to compose a HTTPS `/auth` redirect. This prevents deployment-specific hostname churn. It cannot override Supabase Auth's server-side allowed redirect URLs.

To eliminate `localhost:3000` fallback, configure **Supabase Dashboard → Authentication → URL Configuration** for the existing project:
- **Site URL:** set the active stable app domain (NOT localhost, e.g. the development hostname for staging).
- **Additional Redirect URLs:** allow the EXACT phase URL `https://audition-mobile-mvp-git-work-ac-3c9ef9-toan-freelances-projects.vercel.app/auth` and the relevant development `/auth` URL when promoting.
- Keep Confirm Email enabled. If a customized email template ignores `{{ .ConfirmationURL }}` and hardcodes `{{ .SiteURL }}`, repair the template without embedding any access token in application logs.
- Existing confirmation emails have their old destination; re-test with a newly generated confirmation email. Previously verified accounts may sign in on the stable preview without re-registering.

No edits to Gameplay, RoomState, CAS, Supabase Realtime, WebAudio, M3 character catalog, or animation.

## Admin tab / single-character Creator guard — 22 Nov 2026

### Admin
- `/auth` now exposes an **Admin** tab alongside Login / Signup; admin has its own `/admin` screen.
- Lists Supabase Auth accounts (email, confirmation, created and recent login).
- Deleting an Auth user is intentionally **irreversible**. UI requires retyping the exact email; API verifies target and blocks deleting other admin users.
- The authenticated **current admin may delete their own test account**, then re-register with the same email and confirm email again; the private email allowlist persists across Auth user deletion.
- Authentication is checked on each server request by Supabase GoTrue and the Edge Function, NOT by spoofable client metadata.
- Private allowlist is `public.account_admin_emails`; RLS enabled, zero client policies; SELECT denied to anonymous and authenticated roles.
- Admin-only `auth-admin-v1` Edge Function uses server-only Supabase service credentials and `verify_jwt=true`. The Next.js API forwards the verified HttpOnly-cookie session JWT; no secret key stored in Vercel or browser.
- Only one verified test account (Bondrain) was granted admin access in the existing Supabase database via one-time owner-authorized SQL, **not** by source-file seed data.
- Supabase Auth user deletion cascades to its `player_characters` row. Existing RoomState history is not automatically purged; some old session JWTs may remain until expiry, so this is a QA-only account management tool.
- No client can add its email to the admin allowlist. Never auto-grant admin to a newly registered email outside the prior private allowlist.
- The verified owner should test list access and, if desired, delete a disposable account only after confirming its exact email. No accounts were deleted during implementation.

### Direct URL guard
- Account that already has a server-owned M3 character: direct navigation to `/character/create` sends user to `/rooms`.
- Guest with an already saved M3 draft: same redirect.
- Legacy C1/C4 drafts retain their accepted M3 migration fallback; they are not mistakenly treated as already-created M3 accounts.
- Creator remains used for first creation; editing an existing saved account character will be exposed through the future Dashboard, not through URL manipulation.
- The account character API still allows validated updates to the same row for future Dashboard implementation.

### Owner mobile test requirements
1. Login with existing verified Bondrain account → Auth → Admin.
2. Admin lists exactly the accounts existing in Supabase; no public user list for guests or non-admins.
3. Press Xóa → enter exact target email; wrong email must not delete.
4. If deleting own account, user is logged out; same email can re-register and verify (keep redirect allowlist configured).
5. A registered account with M3 character opening `/character/create` directly must be sent to Room Browser.
6. Confirm that the existing Room Browser / Waiting Room visuals remain unchanged.

The admin functionality is **not** a full production moderation system: no invite flow, audit log, MFA or account recovery UI.
