-- Explicit Host-to-chosen-Guest transfer without anyone leaving the room.
-- Additive to the existing RoomState / revision-CAS protocol.
-- Guard strictly against frozen matches and non-human targets.
create or replace function public.transfer_mvp_room_host(
  p_room_id text,
  p_expected_revision integer,
  p_actor_participant_id text,
  p_target_participant_id text
)
returns table (applied boolean, reason text, room_id text, revision integer, snapshot jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_room public.lobby_rooms%rowtype;
  target_guest jsonb;
  old_slot integer;
  next_participants jsonb;
  next_slots jsonb;
  next_snapshot jsonb;
begin
  if p_room_id !~ '^mvp-[a-zA-Z0-9_-]{1,60}$'
    or p_expected_revision is null or p_expected_revision < 1
    or nullif(p_actor_participant_id,'') is null
    or nullif(p_target_participant_id,'') is null then
    raise exception 'Invalid Host transfer request';
  end if;
  select * into current_room
    from public.lobby_rooms r where r.room_id=p_room_id for update;
  if not found then return; end if;

  if current_room.revision<>p_expected_revision then
    return query select false,'revision-conflict'::text,
      current_room.room_id,current_room.revision,current_room.snapshot;
    return;
  end if;
  if current_room.snapshot->>'status'<>'waiting'
    or coalesce(current_room.snapshot->'matchStart','null'::jsonb)<>'null'::jsonb then
    return query select false,'match-locked'::text,
      current_room.room_id,current_room.revision,current_room.snapshot;
    return;
  end if;
  if current_room.snapshot->>'hostParticipantId'<>p_actor_participant_id then
    return query select false,'not-current-host'::text,
      current_room.room_id,current_room.revision,current_room.snapshot;
    return;
  end if;
  if p_target_participant_id=p_actor_participant_id then
    return query select false,'self-target'::text,
      current_room.room_id,current_room.revision,current_room.snapshot;
    return;
  end if;

  select p into target_guest
    from jsonb_array_elements(current_room.snapshot->'participants') as candidates(p)
    where p->>'participantId'=p_target_participant_id
      and p->>'kind'='human' and p->>'role'='guest'
    limit 1;
  if target_guest is null then
    return query select false,'target-not-human-guest'::text,
      current_room.room_id,current_room.revision,current_room.snapshot;
    return;
  end if;
  old_slot:=(target_guest->>'slotIndex')::integer;
  if old_slot<1 or old_slot>4
    or not exists (
      select 1 from jsonb_array_elements(current_room.snapshot->'slots') as slots(slot)
      where (slot->>'slotIndex')::integer=old_slot
        and slot->>'state'='occupied'
        and slot->>'participantId'=p_target_participant_id
    ) then
    return query select false,'invalid-target-slot'::text,
      current_room.room_id,current_room.revision,current_room.snapshot;
    return;
  end if;

  select jsonb_agg(
    case
      when p->>'participantId'=p_target_participant_id then
        jsonb_set(
          jsonb_set(
            jsonb_set(p,'{role}','"host"'::jsonb),
            '{slotIndex}','0'::jsonb),
          '{readyState}','"not-applicable"'::jsonb)
      when p->>'participantId'=p_actor_participant_id then
        jsonb_set(
          jsonb_set(
            jsonb_set(p,'{role}','"guest"'::jsonb),
            '{slotIndex}',to_jsonb(old_slot)),
          '{readyState}','"not-ready"'::jsonb)
      when p->>'kind'='human' and p->>'role'='guest' then
        jsonb_set(p,'{readyState}','"not-ready"'::jsonb)
      else p
    end order by ordinal
  ) into next_participants
  from jsonb_array_elements(current_room.snapshot->'participants')
    with ordinality as members(p,ordinal);

  select jsonb_agg(
    case
      when (slot->>'slotIndex')::integer=0 then
        jsonb_build_object(
          'slotIndex',0,'state','occupied',
          'participantId',p_target_participant_id)
      when (slot->>'slotIndex')::integer=old_slot then
        jsonb_build_object(
          'slotIndex',old_slot,'state','occupied',
          'participantId',p_actor_participant_id)
      else slot
    end order by ordinal
  ) into next_slots
  from jsonb_array_elements(current_room.snapshot->'slots')
    with ordinality as entries(slot,ordinal);

  next_snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(current_room.snapshot,'{hostParticipantId}',
          to_jsonb(p_target_participant_id)),
        '{participants}',next_participants),
      '{slots}',next_slots),
    '{revision}',to_jsonb(current_room.revision+1));

  update public.lobby_rooms r
  set revision=current_room.revision+1,
      snapshot=next_snapshot,
      updated_at=now()
  where r.room_id=p_room_id and r.revision=current_room.revision;

  -- No new client clocks, room authority, or extra revision/Realtime path.
  -- Preserve heartbeat rows; both remain active after the handoff.
  return query select true,'transferred'::text,
    current_room.room_id,current_room.revision+1,next_snapshot;
end;
$$;
revoke all on function public.transfer_mvp_room_host(text,integer,text,text)
  from public, anon, authenticated;
grant execute on function public.transfer_mvp_room_host(text,integer,text,text)
  to anon, authenticated, service_role;
comment on function public.transfer_mvp_room_host(text,integer,text,text) is
  'MVP-only waiting-room Host-selected Human Guest succession; CAS and role/slot swap, all human Guest Ready reset. Device identity is not production authorization.';
