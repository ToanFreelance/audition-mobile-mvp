create table if not exists public.lobby_rooms (
  room_id text primary key,
  revision integer not null check (revision >= 1),
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.lobby_rooms is
  'P5 authoritative waiting-room snapshots. Clients mutate only through the p53-lobby-room server function.';

alter table public.lobby_rooms enable row level security;

revoke all on table public.lobby_rooms from anon, authenticated;
grant select, insert, update, delete on table public.lobby_rooms to service_role;

create or replace function public.broadcast_lobby_room_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, realtime, pg_temp
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'transportVersion', 1,
      'roomId', new.room_id,
      'senderParticipantId', 'server',
      'messageId', 'server-' || new.room_id || '-' || new.revision::text,
      'payload', jsonb_build_object(
        'kind', 'server-room-snapshot',
        'roomRevision', new.revision,
        'snapshot', new.snapshot
      )
    ),
    'room-event',
    'audition-room:' || new.room_id,
    false
  );
  return new;
end;
$$;

revoke all on function public.broadcast_lobby_room_snapshot() from public, anon, authenticated;

drop trigger if exists lobby_rooms_broadcast_snapshot on public.lobby_rooms;
create trigger lobby_rooms_broadcast_snapshot
after insert or update of snapshot, revision
on public.lobby_rooms
for each row
execute function public.broadcast_lobby_room_snapshot();
