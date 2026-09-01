alter table public.music_charts enable row level security;

grant select, insert, update on table public.music_charts to anon, authenticated;

drop policy if exists "public can read music charts" on public.music_charts;
drop policy if exists "public can insert music charts" on public.music_charts;
drop policy if exists "public can update music charts" on public.music_charts;

create policy "public can read music charts"
on public.music_charts
for select to anon, authenticated
using (true);

create policy "public can insert music charts"
on public.music_charts
for insert to anon, authenticated
with check (true);

create policy "public can update music charts"
on public.music_charts
for update to anon, authenticated
using (true)
with check (true);
