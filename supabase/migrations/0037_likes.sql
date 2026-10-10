-- 0037: likes.
--
-- A participant can like the hike they took part in and the club that ran
-- it. Like ratings, a like needs a confirmed booking on a hike that has
-- already taken place. Counts are public; favourites (following a club for
-- its new hikes) stay a separate, private thing.

create table if not exists tour_likes (
  user_id uuid not null references profiles (id) on delete cascade,
  tour_id uuid not null references tours (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tour_id)
);
create index if not exists tour_likes_tour_idx on tour_likes (tour_id);

create table if not exists club_likes (
  user_id uuid not null references profiles (id) on delete cascade,
  club_id uuid not null references clubs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, club_id)
);
create index if not exists club_likes_club_idx on club_likes (club_id);

alter table tour_likes enable row level security;
alter table club_likes enable row level security;

drop policy if exists "Likes are public" on tour_likes;
create policy "Likes are public" on tour_likes for select using (true);
drop policy if exists "Likes are public" on club_likes;
create policy "Likes are public" on club_likes for select using (true);

drop policy if exists "Participants like the hike they attended" on tour_likes;
create policy "Participants like the hike they attended" on tour_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from bookings b join tours t on t.id = b.tour_id
      where b.user_id = auth.uid() and b.tour_id = tour_likes.tour_id
        and b.status = 'confirmed' and t.date <= current_date
    )
  );
drop policy if exists "People remove their own like" on tour_likes;
create policy "People remove their own like" on tour_likes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Participants like the club they hiked with" on club_likes;
create policy "Participants like the club they hiked with" on club_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from bookings b join tours t on t.id = b.tour_id
      where b.user_id = auth.uid() and t.club_id = club_likes.club_id
        and b.status = 'confirmed' and t.date <= current_date
    )
  );
drop policy if exists "People remove their own like" on club_likes;
create policy "People remove their own like" on club_likes
  for delete to authenticated using (user_id = auth.uid());

-- A frozen account cannot like either.
drop trigger if exists on_aa_guard_inactive_account on tour_likes;
create trigger on_aa_guard_inactive_account before insert or update or delete on tour_likes
  for each row execute function public.guard_inactive_account();
drop trigger if exists on_aa_guard_inactive_account on club_likes;
create trigger on_aa_guard_inactive_account before insert or update or delete on club_likes
  for each row execute function public.guard_inactive_account();

-- Counts for the cards and pages.
create or replace view public.tour_like_counts as
  select tour_id, count(*)::int as likes from tour_likes group by tour_id;
create or replace view public.club_like_counts as
  select club_id, count(*)::int as likes from club_likes group by club_id;
grant select on public.tour_like_counts, public.club_like_counts to anon, authenticated;

-- Everything the signed-in individual's hearts and bookmarks need, in one
-- call: what they follow, what they liked, and what they may like.
create or replace function public.my_engagement()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'favorites', coalesce((select jsonb_agg(club_id) from favorite_clubs where user_id = auth.uid()), '[]'::jsonb),
    'clubLikes', coalesce((select jsonb_agg(club_id) from club_likes where user_id = auth.uid()), '[]'::jsonb),
    'tourLikes', coalesce((select jsonb_agg(tour_id) from tour_likes where user_id = auth.uid()), '[]'::jsonb),
    'attendedTours', coalesce((
      select jsonb_agg(distinct b.tour_id) from bookings b join tours t on t.id = b.tour_id
      where b.user_id = auth.uid() and b.status = 'confirmed' and t.date <= current_date), '[]'::jsonb),
    'attendedClubs', coalesce((
      select jsonb_agg(distinct t.club_id) from bookings b join tours t on t.id = b.tour_id
      where b.user_id = auth.uid() and b.status = 'confirmed' and t.date <= current_date), '[]'::jsonb)
  );
$$;
revoke all on function public.my_engagement() from public, anon;
grant execute on function public.my_engagement() to authenticated;

-- Likes in the activity log.
create or replace function public.log_like()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_table_name = 'tour_likes' then
    perform log_activity(new.user_id, 'tour.liked', 'tour', new.tour_id::text, (select title from tours where id = new.tour_id));
  else
    perform log_activity(new.user_id, 'club.liked', 'club', new.club_id::text, (select name from clubs where id = new.club_id));
  end if;
  return null;
end;
$$;
drop trigger if exists on_zz_log_like on tour_likes;
create trigger on_zz_log_like after insert on tour_likes for each row execute function public.log_like();
drop trigger if exists on_zz_log_like on club_likes;
create trigger on_zz_log_like after insert on club_likes for each row execute function public.log_like();
