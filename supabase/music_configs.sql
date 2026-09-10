create table if not exists public.music_configs (
  id text primary key,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists music_configs_updated_at_idx
  on public.music_configs (updated_at desc);

alter table public.music_configs enable row level security;

-- The app reads/writes through the server route with the Supabase service-role key.
-- No public anon policies are required for this table.
