-- 0012: the fields the FAQ already promises (meeting point/time, cancellation
-- window) plus storage room for the club logo.

alter table tours add column if not exists meeting_point text;
alter table tours add column if not exists meeting_time time;
alter table tours add column if not exists cancel_deadline_hours int;

-- Club logos and covers live in the same bucket, under clubs/<user id>/...
-- so an owner can only write inside their own folder. Public read is already
-- covered by "Guide photos are publicly readable".
drop policy if exists "Club owners upload their club photos" on storage.objects;
create policy "Club owners upload their club photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'clubs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Club owners replace their club photos" on storage.objects;
create policy "Club owners replace their club photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'clubs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Club owners delete their club photos" on storage.objects;
create policy "Club owners delete their club photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'clubs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
