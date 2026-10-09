-- Public directory of only recent MVP rooms. Do not reveal participant
-- identities, character snapshots or historical QA lobby data.
-- Room mutations remain server-authoritative via the existing CAS RPC.
create or replace function public.list_mvp_lobby_rooms()
returns table (
  room_id text,
  room_name text,
  mode_id text,
  player_count integer,
  max_players integer,
  open_slots integer
)
language sql
stable
security definer
set search_path = ''
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
    and r.updated_at >= now() - interval '72 hours'
    and r.snapshot ->> 'status' = 'waiting'
  order by r.updated_at desc
  limit 60;
$$;
revoke all on function public.list_mvp_lobby_rooms() from public;
revoke all on function public.list_mvp_lobby_rooms() from anon, authenticated;
grant execute on function public.list_mvp_lobby_rooms() to anon, authenticated, service_role;
comment on function public.list_mvp_lobby_rooms() is
  'Only sanitized public summaries of recent MVP rooms, no participants or full snapshots. CRUD remains authoritative through existing room CAS RPCs.';
