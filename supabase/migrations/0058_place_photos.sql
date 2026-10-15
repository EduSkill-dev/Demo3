-- 0058: admins upload place photos (folder places/<their id>/ in club-assets).
drop policy if exists "Admins upload place photos" on storage.objects;
create policy "Admins upload place photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'places'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "Admins delete place photos" on storage.objects;
create policy "Admins delete place photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'places'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
