create or replace function public.bootstrap_lobby_room(
  p_room_id text,
  p_snapshot jsonb
)
returns table (
  room_id text,
  revision integer,
  snapshot jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  snapshot_revision integer;
begin
  if p_room_id !~ '^[a-zA-Z0-9_-]{1,64}$' then
    raise exception 'invalid room id';
  end if;
  if p_snapshot is null or p_snapshot ->> 'roomId' is distinct from p_room_id then
    raise exception 'snapshot room id mismatch';
  end if;

  snapshot_revision := coalesce((p_snapshot ->> 'revision')::integer, 0);
  if snapshot_revision < 1 then
    raise exception 'invalid snapshot revision';
  end if;

  insert into public.lobby_rooms(room_id, revision, snapshot)
  values (p_room_id, snapshot_revision, p_snapshot)
  on conflict on constraint lobby_rooms_pkey do nothing;

  return query
  select r.room_id, r.revision, r.snapshot
  from public.lobby_rooms r
  where r.room_id = p_room_id
  limit 1;
end;
$$;

revoke all on function public.bootstrap_lobby_room(text, jsonb) from public;
grant execute on function public.bootstrap_lobby_room(text, jsonb) to anon, authenticated, service_role;
