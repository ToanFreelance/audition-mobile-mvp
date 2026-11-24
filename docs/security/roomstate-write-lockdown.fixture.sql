-- ACL-only test fixture. No connection to Supabase and no production data.
-- Run in a fresh disposable PostgreSQL 17 database as postgres.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table public.player_characters (
  user_id uuid primary key,
  profile jsonb not null,
  revision integer not null,
  updated_at timestamptz not null default now()
);
alter table public.player_characters enable row level security;
create policy player_characters_select_own on public.player_characters for select to authenticated
 using (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
create policy player_characters_insert_own on public.player_characters for insert to authenticated
 with check (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
create policy player_characters_update_own on public.player_characters for update to authenticated
 using (user_id = current_setting('request.jwt.claim.sub', true)::uuid)
 with check (user_id = current_setting('request.jwt.claim.sub', true)::uuid);
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, truncate, references, trigger on public.player_characters to authenticated;
grant select, delete, truncate, references, trigger on public.player_characters to service_role;
-- Explicit column grants test the independent ACL path, in addition to live table grants.
grant insert(profile), update(profile), references(user_id) on public.player_characters to authenticated;
create function public.bootstrap_lobby_room(text,jsonb) returns integer language sql security definer as 'select 1';
create function public.compare_and_swap_lobby_room(text,integer,jsonb) returns integer language sql security definer as 'select 1';
create function public.handoff_mvp_room_host(text,integer,text,boolean) returns integer language sql security definer as 'select 1';
create function public.transfer_mvp_room_host(text,integer,text,text) returns integer language sql security definer as 'select 1';
create function public.touch_mvp_lobby_room(text,text) returns integer language sql security definer as 'select 1';
create function public.touch_mvp_room_member(text,text) returns integer language sql security definer as 'select 1';
create function public.close_mvp_lobby_room(text,integer,text) returns integer language sql security definer as 'select 1';
create function public.get_lobby_room(text) returns integer language sql security definer as 'select 1';
create function public.list_mvp_lobby_rooms() returns integer language sql security definer as 'select 1';
grant execute on all functions in schema public to anon, authenticated, service_role;
revoke execute on function public.close_mvp_lobby_room(text,integer,text) from public, anon, authenticated;
\ir roomstate-write-lockdown.pending.sql
do $$
declare
  r text;
  f regprocedure;
  privilege text;
begin
  foreach f in array array[
    'public.bootstrap_lobby_room(text,jsonb)'::regprocedure,
    'public.compare_and_swap_lobby_room(text,integer,jsonb)'::regprocedure,
    'public.handoff_mvp_room_host(text,integer,text,boolean)'::regprocedure,
    'public.transfer_mvp_room_host(text,integer,text,text)'::regprocedure,
    'public.touch_mvp_lobby_room(text,text)'::regprocedure,
    'public.touch_mvp_room_member(text,text)'::regprocedure,
    'public.close_mvp_lobby_room(text,integer,text)'::regprocedure
  ] loop
    if has_function_privilege('anon', f, 'EXECUTE') or has_function_privilege('authenticated', f, 'EXECUTE')
      or not has_function_privilege('service_role', f, 'EXECUTE') then
      raise exception 'Unexpected effective RPC ACL: %', f;
    end if;
  end loop;
  foreach r in array array['anon','authenticated'] loop
    foreach privilege in array array['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES'] loop
      if has_table_privilege(r,'public.player_characters',privilege) then
        raise exception 'Unexpected table ACL: % %', r, privilege;
      end if;
    end loop;
    foreach privilege in array array['INSERT','UPDATE','REFERENCES'] loop
      if has_any_column_privilege(r,'public.player_characters',privilege) then
        raise exception 'Unexpected column ACL: % %', r, privilege;
      end if;
    end loop;
    if not has_function_privilege(r,'public.get_lobby_room(text)','EXECUTE')
      or not has_function_privilege(r,'public.list_mvp_lobby_rooms()','EXECUTE') then
      raise exception 'Read RPC removed: %', r;
    end if;
  end loop;
  foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
    if not has_table_privilege('service_role','public.player_characters',privilege) then
      raise exception 'Missing service_role ACL: %', privilege;
    end if;
  end loop;
  if not has_table_privilege('authenticated','public.player_characters','SELECT')
    or has_table_privilege('anon','public.player_characters','SELECT')
    or not (select relrowsecurity from pg_class where oid='public.player_characters'::regclass) then
    raise exception 'Profile read or RLS regression';
  end if;
end $$;
set role service_role;
insert into public.player_characters(user_id,profile,revision) values
 ('11111111-1111-4111-8111-111111111111','{}',1),
 ('22222222-2222-4222-8222-222222222222','{}',1);
update public.player_characters set revision=2 where user_id='11111111-1111-4111-8111-111111111111';
reset role;
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
begin
  if (select count(*) from public.player_characters) <> 1
    or (select revision from public.player_characters) <> 2 then
    raise exception 'Own-profile RLS read failed';
  end if;
  begin
    update public.player_characters set revision=3;
    raise exception 'Direct authenticated write unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo ACL fixture PASS (not full Supabase schema/runtime validation)
