-- MVP waiting-room host migration. Preserve the established RoomState/CAS
-- protocol and never touch a frozen MatchManifest, countdown or playing match.
-- No public table access. Arrival order is participants JSON array order.
create table if not exists public.mvp_room_member_lease (
  room_id text not null,
  participant_id text not null,
  last_seen_at timestamptz not null default now(),
  primary key (room_id, participant_id)
);
alter table public.mvp_room_member_lease enable row level security;
revoke all on public.mvp_room_member_lease from anon, authenticated;

create or replace function public.touch_mvp_room_member(
  p_room_id text,
  p_participant_id text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  current_host text;
begin
  if p_room_id !~ '^mvp-[a-zA-Z0-9_-]{1,60}$'
    or p_participant_id is null then return false; end if;
  select r.snapshot->>'hostParticipantId' into current_host
  from public.lobby_rooms r
  where r.room_id=p_room_id and r.snapshot->>'status'='waiting'
    and exists (
      select 1 from jsonb_array_elements(r.snapshot->'participants') p
      where p->>'participantId'=p_participant_id and p->>'kind'='human'
    );
  if not found then return false; end if;

  insert into public.mvp_room_member_lease (room_id,participant_id,last_seen_at)
    values (p_room_id,p_participant_id,now())
  on conflict (room_id,participant_id) do update set last_seen_at=excluded.last_seen_at;
  -- Directory updated_at is only moved by the current Host; a guest must
  -- never prolong the listing of a room abandoned by its host.
  if current_host=p_participant_id then
    update public.lobby_rooms r set updated_at=now()
      where r.room_id=p_room_id
        and r.snapshot->>'status'='waiting'
        and r.snapshot->>'hostParticipantId'=p_participant_id;
  end if;
  return true;
end;
$$;
revoke all on function public.touch_mvp_room_member(text,text) from public, anon, authenticated;
grant execute on function public.touch_mvp_room_member(text,text) to anon, authenticated, service_role;

-- Atomic role migration. A host may leave explicitly at any revision given
-- by the caller; a guest may trigger recovery only after a verified 75-second
-- missed-host lease. Room row lock serializes against normal CAS and heartbeat.
create or replace function public.handoff_mvp_room_host(
  p_room_id text,
  p_expected_revision integer,
  p_actor_participant_id text,
  p_disconnect boolean default false
)
returns table (
  applied boolean,
  closed boolean,
  reason text,
  room_id text,
  revision integer,
  snapshot jsonb
)
language plpgsql security definer set search_path = ''
as $$
declare
  current_room public.lobby_rooms%rowtype;
  host_id text;
  next_host_id text;
  next_participants jsonb;
  next_slots jsonb;
  next_snapshot jsonb;
begin
  if p_room_id !~ '^mvp-[a-zA-Z0-9_-]{1,60}$'
    or p_actor_participant_id is null or p_expected_revision < 1 then
    raise exception 'Invalid host handoff request';
  end if;
  select * into current_room from public.lobby_rooms r
    where r.room_id=p_room_id for update;
  if not found then return; end if;
  if current_room.revision<>p_expected_revision then
    return query select false,false,'revision-conflict'::text,
      current_room.room_id,current_room.revision,current_room.snapshot;
    return;
  end if;
  if current_room.snapshot->>'status'<>'waiting'
    or current_room.snapshot->'matchStart'<>'null'::jsonb then
    return query select false,false,'match-locked'::text,
      current_room.room_id,current_room.revision,current_room.snapshot;
    return;
  end if;
  host_id:=current_room.snapshot->>'hostParticipantId';
  if p_disconnect then
    -- Only an actively heartbeating human Guest may ask for recovery.
    if not exists (
      select 1 from jsonb_array_elements(current_room.snapshot->'participants') p
      join public.mvp_room_member_lease l
        on l.room_id=p_room_id and l.participant_id=p->>'participantId'
      where p->>'participantId'=p_actor_participant_id
        and p->>'role'='guest' and p->>'kind'='human'
        and l.last_seen_at>=now()-interval '75 seconds'
    ) then
      return query select false,false,'requester-not-live'::text,
        current_room.room_id,current_room.revision,current_room.snapshot;
      return;
    end if;
    if exists (
      select 1 from public.mvp_room_member_lease l
      where l.room_id=p_room_id and l.participant_id=host_id
        and l.last_seen_at>=now()-interval '75 seconds'
    ) then
      return query select false,false,'host-still-live'::text,
        current_room.room_id,current_room.revision,current_room.snapshot;
      return;
    end if;
    -- Grace after room creation and after any join, to prevent a guest from
    -- immediately evicting a host before its first heartbeat.
    if current_room.updated_at>=now()-interval '75 seconds' then
      return query select false,false,'host-grace'::text,
        current_room.room_id,current_room.revision,current_room.snapshot;
      return;
    end if;
  elsif p_actor_participant_id<>host_id then
    return query select false,false,'not-host'::text,
      current_room.room_id,current_room.revision,current_room.snapshot;
    return;
  end if;

  -- Oldest human Guest still present wins. Array order is append-on-join,
  -- unlike slot indexes that can be reused after departures.
  select p->>'participantId' into next_host_id
  from jsonb_array_elements(current_room.snapshot->'participants') with ordinality as members(p,ord)
  where p->>'kind'='human' and p->>'role'='guest'
    and (
      not p_disconnect or exists (
        select 1 from public.mvp_room_member_lease l
        where l.room_id=p_room_id and l.participant_id=p->>'participantId'
          and l.last_seen_at>=now()-interval '75 seconds'
      )
    )
  order by ord limit 1;

  if next_host_id is null then
    if not p_disconnect then
      -- Last player left, or no present guests: close. Never leave a
      -- waiting room with an invalid/missing Host.
      delete from public.lobby_rooms r where r.room_id=p_room_id;
      delete from public.mvp_room_member_lease l where l.room_id=p_room_id;
      return query select true,true,'closed-empty'::text,
        current_room.room_id,current_room.revision,current_room.snapshot;
      return;
    end if;
    return query select false,false,'no-live-guest'::text,
      current_room.room_id,current_room.revision,current_room.snapshot;
    return;
  end if;

  select jsonb_agg(
    case
      when p->>'participantId'=next_host_id then
        jsonb_set(jsonb_set(jsonb_set(jsonb_set(p,
          '{role}','"host"'::jsonb),
          '{readyState}','"not-applicable"'::jsonb),
          '{slotIndex}','0'::jsonb),
          '{connectionState}','"connected"'::jsonb)
      when p->>'kind'='human' and p->>'role'='guest' then
        jsonb_set(p,'{readyState}','"not-ready"'::jsonb)
      else p
    end order by ord
  ) into next_participants
  from jsonb_array_elements(current_room.snapshot->'participants') with ordinality as members(p,ord)
  where p->>'participantId'<>host_id;

  select jsonb_agg(
    case
      when (slot->>'slotIndex')::integer=0 then
        jsonb_build_object('slotIndex',0,'state','occupied','participantId',next_host_id)
      when slot->>'participantId'=next_host_id then
        jsonb_build_object('slotIndex',(slot->>'slotIndex')::integer,'state','open')
      else slot
    end order by ord
  ) into next_slots
  from jsonb_array_elements(current_room.snapshot->'slots') with ordinality as entries(slot,ord);

  next_snapshot:=jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(current_room.snapshot,'{hostParticipantId}',to_jsonb(next_host_id)),
        '{participants}',next_participants),
      '{slots}',next_slots),
    '{revision}',to_jsonb(current_room.revision+1));
  update public.lobby_rooms r set
    revision=current_room.revision+1,
    snapshot=next_snapshot,
    updated_at=now()
    where r.room_id=p_room_id and r.revision=current_room.revision;
  delete from public.mvp_room_member_lease l
    where l.room_id=p_room_id and l.participant_id=host_id;
  -- Maintain the room listing while the new Host takes over; the recipient
  -- will subsequently keep it alive with its own visible-tab heartbeat.
  insert into public.mvp_room_member_lease (room_id,participant_id,last_seen_at)
    values (p_room_id,next_host_id,now())
  on conflict (room_id,participant_id) do update set last_seen_at=excluded.last_seen_at;
  return query select true,false,'transferred'::text,
    current_room.room_id,current_room.revision+1,next_snapshot;
end;
$$;
revoke all on function public.handoff_mvp_room_host(text,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.handoff_mvp_room_host(text,integer,text,boolean) to anon,authenticated,service_role;
-- Deprecate the obsolete public RPC that deleted occupied waiting rooms.
revoke execute on function public.close_mvp_lobby_room(text,integer,text) from anon,authenticated;

comment on function public.handoff_mvp_room_host(text,integer,text,boolean) is
  'CAS role migration of earliest joined active human guest on explicit host leave or missed heartbeat; waiting only, no changes to live match.';
