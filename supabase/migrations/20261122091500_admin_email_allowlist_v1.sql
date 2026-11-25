-- Temporary Admin V1. No publicly available admin enrollment mechanism.
-- Account access persists when the owner deletes and re-registers a verified
-- email for testing; authorization checks email verification on EVERY request.
create table if not exists public.account_admin_emails (
  email text primary key check(email = lower(btrim(email)) and length(email) between 3 and 254),
  granted_at timestamptz not null default now(),
  note text
);
alter table public.account_admin_emails enable row level security;
revoke all on public.account_admin_emails from PUBLIC, anon, authenticated;
grant select on public.account_admin_emails to service_role;
-- Intentionally no RLS policies or client-facing grant. Only service-role
-- Edge Functions can inspect the allowlist. Never put admin email in source.
