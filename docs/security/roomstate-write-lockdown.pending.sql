-- REVIEW ONLY. Do not apply to shared project until owner approves cutover.
-- Promote to a versioned migration after isolated verification and ledger review.
-- Keep existing RPC bodies, atomic CAS, trigger/Realtime and read contracts.
begin;
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
do $
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
end $;
commit;
