-- Club profile data: guides as real rows (name, surname, photo) plus a public
-- storage bucket for their photos.

create table if not exists club_guides (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists club_guides_club_id_idx on club_guides (club_id);

alter table club_guides enable row level security;

-- Everyone landing on a club page can see its guides...
drop policy if exists "Guides are readable by everyone" on club_guides;
create policy "Guides are readable by everyone" on club_guides
  for select using (true);

-- ...but only the club owner can add, edit or remove them.
drop policy if exists "Club owners manage their guides" on club_guides;
create policy "Club owners manage their guides" on club_guides
  for all using (
    exists (select 1 from clubs c where c.id = club_guides.club_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from clubs c where c.id = club_guides.club_id and c.owner_id = auth.uid())
  );

-- Storage: one public bucket for club-owned images.
insert into storage.buckets (id, name, public)
values ('club-assets', 'club-assets', true)
on conflict (id) do update set public = true;

-- Photos live under guides/<user id>/<file>, so owners can only write inside
-- their own folder.
drop policy if exists "Club owners upload their guide photos" on storage.objects;
create policy "Club owners upload their guide photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'guides'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Club owners replace their guide photos" on storage.objects;
create policy "Club owners replace their guide photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'guides'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Club owners delete their guide photos" on storage.objects;
create policy "Club owners delete their guide photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'guides'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- The bucket is public, so reads work without a row policy, but add one for
-- setups where the public flag alone is not honoured.
drop policy if exists "Guide photos are publicly readable" on storage.objects;
create policy "Guide photos are publicly readable" on storage.objects
  for select using (bucket_id = 'club-assets');
