-- Test Admin unlock: strong random code hash, short-lived and revocable.
-- Do not store the raw code in Git or grant public/client access.
create table if not exists public.admin_quick_access (
  access_id text primary key check (access_id = 'auth-v1-test'),
  code_sha256 text not null check (code_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  enabled boolean not null default true
);
alter table public.admin_quick_access enable row level security;
revoke all on public.admin_quick_access from PUBLIC, anon, authenticated;
grant select on public.admin_quick_access to service_role;
-- The only row is seeded securely during deployment, NOT in this migration.
