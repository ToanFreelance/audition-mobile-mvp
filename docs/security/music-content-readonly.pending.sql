-- REVIEW ONLY. Separate owner approval required. No audio/chart data changes.
-- Freeze authored content during MVP integration, preserve public read/list/play.
-- Do NOT grant service_role chart writes: old deployments have unguarded routes.
begin;
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
commit;
