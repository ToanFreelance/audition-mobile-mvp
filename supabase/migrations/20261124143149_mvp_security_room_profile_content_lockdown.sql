-- Record the previously owner-approved and applied ACL lockdown; idempotent DCL and policy drops only.
-- Keep existing RPC bodies, atomic CAS, trigger/Realtime and read contracts.

revoke execute on function public.bootstrap_lobby_room(text,jsonb) from public, anon, authenticated;
revoke execute on function public.compare_and_swap_lobby_room(text,integer,jsonb) from public, anon, authenticated;
revoke execute on function public.handoff_mvp_room_host(text,integer,text,boolean) from public, anon, authenticated;
revoke execute on function public.transfer_mvp_room_host(text,integer,text,text) from public, anon, authenticated;
revoke execute on function public.touch_mvp_lobby_room(text,text) from public, anon, authenticated;
revoke execute on function public.touch_mvp_room_member(text,text) from public, anon, authenticated;
revoke execute on function public.close_mvp_lobby_room(text,integer,text) from public, anon, authenticated;
grant execute on function public.bootstrap_lobby_room(text,jsonb),
 public.compare_and_swap_lobby_room(text,integer,jsonb),
 public.handoff_mvp_room_host(text,integer,text,boolean),
 public.transfer_mvp_room_host(text,integer,text,text),
 public.touch_mvp_lobby_room(text,text),
 public.touch_mvp_room_member(text,text),
 public.close_mvp_lobby_room(text,integer,text) to service_role;
revoke insert, update, delete, truncate, trigger, references on public.player_characters from public, anon, authenticated;
-- Column-level grants are independent of table-level privileges.
revoke insert(user_id,profile,revision,updated_at), update(user_id,profile,revision,updated_at), references(user_id,profile,revision,updated_at)
 on public.player_characters from public, anon, authenticated;
grant select, insert, update on public.player_characters to service_role;
-- Preserve own-profile SELECT under RLS and existing admin reset DELETE grant.
grant select on public.player_characters to authenticated;
do $$
declare r text; f regprocedure; privilege text;
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
  if has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('authenticated',f,'EXECUTE')
     or not has_function_privilege('service_role',f,'EXECUTE') then
   raise exception 'Unexpected effective RoomState ACL: %',f;
  end if;
 end loop;
 foreach r in array array['anon','authenticated'] loop
  foreach privilege in array array['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES'] loop
   if has_table_privilege(r,'public.player_characters',privilege) then
    raise exception 'Unexpected profile ACL: % %',r,privilege;
   end if;
  end loop;
  foreach privilege in array array['INSERT','UPDATE','REFERENCES'] loop
   if has_any_column_privilege(r,'public.player_characters',privilege) then
    raise exception 'Unexpected profile column ACL: % %',r,privilege;
   end if;
  end loop;
  if not has_function_privilege(r,'public.get_lobby_room(text)','EXECUTE')
    or not has_function_privilege(r,'public.list_mvp_lobby_rooms()','EXECUTE') then
   raise exception 'Room read RPC removed: %',r;
  end if;
 end loop;
 if not has_table_privilege('authenticated','public.player_characters','SELECT')
   or has_table_privilege('anon','public.player_characters','SELECT')
   or not (select relrowsecurity from pg_class where oid='public.player_characters'::regclass) then
  raise exception 'Profile read or RLS regression';
 end if;
end $$;

-- Freeze authored content during MVP integration, preserve public read/list/play.
-- Do NOT grant service_role chart writes: old deployments have unguarded routes.

revoke insert, update, delete, truncate, trigger, references on public.music_charts from public, anon, authenticated;
revoke insert(id,title,artist,audio_url,duration_ms,bpm,space_start_ms,space_start_beat,gauge,gameplay,notes,updated_at,bpm_exact,reference_bpm,reference_source),
 update(id,title,artist,audio_url,duration_ms,bpm,space_start_ms,space_start_beat,gauge,gameplay,notes,updated_at,bpm_exact,reference_bpm,reference_source),
 references(id,title,artist,audio_url,duration_ms,bpm,space_start_ms,space_start_beat,gauge,gameplay,notes,updated_at,bpm_exact,reference_bpm,reference_source)
 on public.music_charts from public, anon, authenticated;
drop policy if exists "Public can delete music charts" on public.music_charts;
drop policy if exists "authenticated users can insert music charts" on public.music_charts;
drop policy if exists "authenticated users can update music charts" on public.music_charts;
drop policy if exists "public can insert music charts" on public.music_charts;
drop policy if exists "public can update music charts" on public.music_charts;
-- Only the two audited audio policies. Never revoke shared storage.objects
-- table privileges or change any other bucket's policies.
drop policy if exists "Public can upload audio files" on storage.objects;
drop policy if exists "Public can delete audio files" on storage.objects;
do $$
declare r text; privilege text;
begin
  foreach r in array array['anon','authenticated'] loop
    if not has_table_privilege(r,'public.music_charts','SELECT') then
      raise exception 'Public chart read removed: %',r;
    end if;
    foreach privilege in array array['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES'] loop
      if has_table_privilege(r,'public.music_charts',privilege) then
        raise exception 'Unexpected public chart ACL: % %',r,privilege;
      end if;
    end loop;
    foreach privilege in array array['INSERT','UPDATE','REFERENCES'] loop
      if has_any_column_privilege(r,'public.music_charts',privilege) then
        raise exception 'Unexpected public chart column ACL: % %',r,privilege;
      end if;
    end loop;
  end loop;
  if not (select relrowsecurity from pg_class where oid='public.music_charts'::regclass)
    or not (select relrowsecurity from pg_class where oid='storage.objects'::regclass) then
    raise exception 'Required RLS missing';
  end if;
  -- Fail closed if the audited storage policy set has drifted. A new write
  -- policy, even for another bucket, needs review rather than implicit removal.
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and cmd in ('INSERT','UPDATE','DELETE','ALL')) then
    raise exception 'Storage write policy drift: review before cutover';
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and policyname='Public can list audio library' and cmd='SELECT') then
    raise exception 'Audio listing policy missing';
  end if;
  if has_table_privilege('service_role','public.music_charts','INSERT')
    or has_table_privilege('service_role','public.music_charts','UPDATE')
    or has_table_privilege('service_role','public.music_charts','DELETE') then
    raise exception 'Unexpected service-role chart write ACL; review old deployments';
  end if;
end $$;
