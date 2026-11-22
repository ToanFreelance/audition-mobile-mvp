-- Auth QA Reset NV: keep the one-character-per-account RLS contract.
-- The browser/authenticated role must still be unable to delete characters.
-- Only the server-side Supabase Edge Function uses service_role.
grant select, delete on table public.player_characters to service_role;
