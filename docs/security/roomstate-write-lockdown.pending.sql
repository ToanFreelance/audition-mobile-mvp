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
commit;
