-- Explicit host-close and bounded host liveness for the MVP Room Browser.
-- Preserve the canonical RoomState snapshot/revision and its existing CAS RPC.
-- Only waiting MVP rooms can be closed or heartbeat-refreshed.
create or replace function public.close_mvp_lobby_room(
  p_room_id text,
  p_expected_revision integer,
  p_host_participant_id text
)
returns table (applied boolean, room_id text, revision integer, snapshot jsonb)
language plpgsql security definer set search_path = ''
as $$
declare
  closed public.lobby_rooms%rowtype;
begin
  if p_room_id !~ '^mvp-[a-zA-Z0-9_-]{1,60}$'
    or p_host_participant_id is null or length(p_host_participant_id) < 1
    or p_expected_revision < 1 then
    raise exception 'invalid MVP close request';
  end if;

  delete from public.lobby_rooms r
  where r.room_id = p_room_id
    and r.revision = p_expected_revision
    and r.snapshot ->> 'status' = 'waiting'
    and r.snapshot ->> 'hostParticipantId' = p_host_participant_id
  returning r.* into closed;
  if found then
    return query select true, closed.room_id, closed.revision, closed.snapshot;
    return;
  end if;
  return query
    select false, r.room_id, r.revision, r.snapshot
    from public.lobby_rooms r
    where r.room_id = p_room_id
    limit 1;
end;
$$;
revoke all on function public.close_mvp_lobby_room(text, integer, text) from public;
revoke all on function public.close_mvp_lobby_room(text, integer, text) from anon, authenticated;
grant execute on function public.close_mvp_lobby_room(text, integer, text) to anon, authenticated, service_role;

-- Host liveness is metadata-only; it MUST NOT alter the snapshot or revision
-- that the compare-and-swap RPC owns. Room Browser uses a short lease window.
create or replace function public.touch_mvp_lobby_room(
  p_room_id text,
  p_host_participant_id text
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_room_id !~ '^mvp-[a-zA-Z0-9_-]{1,60}$'
    or p_host_participant_id is null or length(p_host_participant_id) < 1 then
    return false;
  end if;
  update public.lobby_rooms r
  set updated_at = now()
  where r.room_id = p_room_id
    and r.snapshot ->> 'status' = 'waiting'
    and r.snapshot ->> 'hostParticipantId' = p_host_participant_id;
  return found;
end;
$$;
revoke all on function public.touch_mvp_lobby_room(text, text) from public;
revoke all on function public.touch_mvp_lobby_room(text, text) from anon, authenticated;
grant execute on function public.touch_mvp_lobby_room(text, text) to anon, authenticated, service_role;

-- Replace the old 72-hour "waiting" directory condition. This list is a
-- liveness view, not a historical room registry. Crashed/closed tabs stop
-- heartbeating; they disappear within 3 minutes without deleting match data.
create or replace function public.list_mvp_lobby_rooms()
returns table (
  room_id text,
  room_name text,
  mode_id text,
  player_count integer,
  max_players integer,
  open_slots integer
)
language sql stable security definer set search_path = ''
as $$
  select
    r.room_id,
    left(coalesce(r.snapshot ->> 'roomName', 'Dance Room'), 32)::text,
    coalesce(r.snapshot ->> 'modeId', 'solo-easy-battle')::text,
    jsonb_array_length(coalesce(r.snapshot -> 'participants', '[]'::jsonb))::integer,
    least(5, (r.snapshot ->> 'maxPlayers')::integer)::integer,
    (
      select count(*)::integer
      from jsonb_array_elements(coalesce(r.snapshot -> 'slots', '[]'::jsonb)) as s(slot)
      where s.slot ->> 'state' = 'open'
        and (s.slot ->> 'slotIndex')::integer < 5
    ) as open_slots
  from public.lobby_rooms r
  where r.room_id like 'mvp-%'
    and r.updated_at >= now() - interval '3 minutes'
    and r.snapshot ->> 'status' = 'waiting'
  order by r.updated_at desc
  limit 60;
$$;
revoke all on function public.list_mvp_lobby_rooms() from public;
revoke all on function public.list_mvp_lobby_rooms() from anon, authenticated;
grant execute on function public.list_mvp_lobby_rooms() to anon, authenticated, service_role;
comment on function public.list_mvp_lobby_rooms() is
  'Sanitized MVP waiting-room summaries only; includes rooms with host activity during the past 3 minutes.';
