-- Club profile fields (filled from the club's dashboard, later) and the
-- read/write rules for ratings & comments.

alter table clubs add column if not exists photo_url text;
alter table clubs add column if not exists description text;
alter table clubs add column if not exists team_info text;
alter table clubs add column if not exists guides_info text;
alter table clubs add column if not exists focus_areas text;

-- Ratings/comments are public to read (so club pages can show them)...
drop policy if exists "Ratings are readable by everyone" on ratings;
create policy "Ratings are readable by everyone" on ratings
  for select using (true);

-- ...but only postable by someone who actually attended one of that club's
-- tours. This won't be usable until the booking flow exists — that's fine,
-- it's ready for when it does.
drop policy if exists "Only attendees can rate a club" on ratings;
create policy "Only attendees can rate a club" on ratings
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      (club_id is not null and exists (
        select 1 from bookings b
        join tours t on t.id = b.tour_id
        where b.user_id = auth.uid() and t.club_id = ratings.club_id and b.status = 'confirmed'
      ))
      or
      (tour_id is not null and exists (
        select 1 from bookings b
        where b.user_id = auth.uid() and b.tour_id = ratings.tour_id and b.status = 'confirmed'
      ))
    )
  );
