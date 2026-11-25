-- Email/password account foundation. Additive; legacy guest rooms are unchanged.
-- user_id is the unique identity of a single M3 character owned by one auth user.
create table if not exists public.player_characters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint player_characters_m3_only check (
    profile->>'characterAssetId' in ('m3-drophunter', 'm3-neurohacker')
  )
);

alter table public.player_characters enable row level security;

drop policy if exists player_characters_select_own on public.player_characters;
create policy player_characters_select_own on public.player_characters
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists player_characters_insert_own on public.player_characters;
create policy player_characters_insert_own on public.player_characters
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists player_characters_update_own on public.player_characters;
create policy player_characters_update_own on public.player_characters
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.player_characters from anon;
grant select, insert, update on public.player_characters to authenticated;
-- No DELETE policy/grant: creator is edited in place, not duplicated.
