-- Highland — 0011: one idempotent run for everything the app assumes but the
-- database is still missing, plus the new rating/notification rules and the
-- storage policies for tour photos.
--
-- Safe to re-run, and safe to run even if you think you already ran 0004/0008:
-- on this project those two never made it into the SQL editor, which is why
-- /about showed "—", profile saving failed, and no notifications were written.

-- 1) Profile columns (was 0008) ------------------------------------------
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists photo_url text;

-- 2) Public about-page stats (was 0004) ----------------------------------
create or replace function public.get_about_stats()
returns table (
  clubs_count bigint,
  users_count bigint,
  tours_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.clubs),
    (select count(*) from public.profiles),
    (select count(*) from public.tours);
$$;

revoke all on function public.get_about_stats() from public;
grant execute on function public.get_about_stats() to anon, authenticated;

-- 3) Notify a club's fans when it publishes a tour (was 0008) -------------
create or replace function public.notify_favorites_on_new_tour()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  club_name_value text;
begin
  select name into club_name_value from clubs where id = new.club_id;

  insert into notifications (user_id, club_id, message)
  select user_id, new.club_id,
    coalesce(club_name_value, 'Ակումբը') || ' հրապարակեց նոր արշավ՝ "' || new.title || '"'
  from favorite_clubs
    where club_id = new.club_id;

  return new;
end;
$$;

drop trigger if exists on_tour_created_notify_favorites on tours;
create trigger on_tour_created_notify_favorites
  after insert on tours
  for each row execute function public.notify_favorites_on_new_tour();

-- 4) Notifications: the table had RLS enabled but no policy at all, so not
--    even the owner could read their own rows.
drop policy if exists "Users manage their own notifications" on notifications;
create policy "Users manage their own notifications" on notifications
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5) Ratings: a user rates a given tour (or a given club) once.
--    Partial unique indexes, so tour_id/club_id NULLs are unaffected.
create unique index if not exists ratings_one_per_user_tour
  on ratings (user_id, tour_id) where tour_id is not null;

create unique index if not exists ratings_one_per_user_club
  on ratings (user_id, club_id) where club_id is not null;

-- 6) Let people fix or withdraw their own rating/comment.
drop policy if exists "Users update their own ratings" on ratings;
create policy "Users update their own ratings" on ratings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete their own ratings" on ratings;
create policy "Users delete their own ratings" on ratings
  for delete using (auth.uid() = user_id);

-- 7) Tour photos live in the same bucket, under tours/<user id>/... so the
--    club owner may only write inside their own folder (public read is
--    already covered by "Guide photos are publicly readable").
drop policy if exists "Club owners upload their tour photos" on storage.objects;
create policy "Club owners upload their tour photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'tours'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Club owners replace their tour photos" on storage.objects;
create policy "Club owners replace their tour photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'tours'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Club owners delete their tour photos" on storage.objects;
create policy "Club owners delete their tour photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'tours'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
