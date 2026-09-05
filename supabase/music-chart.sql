-- Run this in Supabase SQL Editor for the persistent chart database.
create table if not exists public.music_charts (
  id text primary key,
  title text not null,
  artist text,
  audio_url text not null,
  duration_ms integer not null default 0,
  bpm numeric not null,
  space_start_ms integer not null,
  space_start_beat numeric,
  gauge jsonb not null default '{}'::jsonb,
  gameplay jsonb not null default '{}'::jsonb,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.music_charts enable row level security;

-- For the private chart editor during testing, use authenticated access later.
-- Do not expose service-role credentials in the browser.
create policy "authenticated users can read music charts"
on public.music_charts for select
to authenticated
using (true);

create policy "authenticated users can insert music charts"
on public.music_charts for insert
to authenticated
with check (true);

create policy "authenticated users can update music charts"
on public.music_charts for update
to authenticated
using (true)
with check (true);
