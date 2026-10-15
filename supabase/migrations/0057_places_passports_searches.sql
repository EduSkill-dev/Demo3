-- 0057: place pages, hiker passports, saved searches.
--
-- * Places get a photo and a short text per language (set by admins), and
--   hearts — only from people who took part in a hike to the place.
-- * An individual can show a "hiker passport" (places visited, badges) on
--   the public Hikers page; it is off until they switch it on.
-- * Saved searches replace following a club: up to five per person, each a
--   set of filters (region, place, kind of place, club, dates, overnight).
--   A new hike that matches any of them arrives as a notification. Existing
--   follows become club-only saved searches. Hearts for clubs are retired
--   (the rating is enough); the tables stay for the record.

-- 1) Places: photo and text ------------------------------------------------------
alter table sights add column if not exists photo_url text;
alter table sights add column if not exists description_hy text;
alter table sights add column if not exists description_ru text;
alter table sights add column if not exists description_en text;

-- 2) Hearts for places -------------------------------------------------------------
create table if not exists sight_likes (
  user_id uuid not null references profiles (id) on delete cascade,
  sight_id uuid not null references sights (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sight_id)
);
create index if not exists sight_likes_sight_idx on sight_likes (sight_id);
alter table sight_likes enable row level security;

drop policy if exists "Place hearts are public" on sight_likes;
create policy "Place hearts are public" on sight_likes for select using (true);

drop policy if exists "Participants heart a place they went to" on sight_likes;
create policy "Participants heart a place they went to" on sight_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from bookings b join tours t on t.id = b.tour_id
      where b.user_id = auth.uid() and sight_likes.sight_id = any (t.sight_ids)
        and b.status = 'confirmed' and b.attended is distinct from false and t.date <= current_date
    )
  );
drop policy if exists "People remove their own place heart" on sight_likes;
create policy "People remove their own place heart" on sight_likes
  for delete to authenticated using (user_id = auth.uid());

-- Per place: hearts, hikes (all, and still to come) and, when admins have not
-- set a photo, the newest photo of a hike that went there.
create or replace function public.sight_stats()
returns table (sight_id uuid, likes int, hikes int, upcoming int, tour_photo text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id,
    (select count(*) from sight_likes l where l.sight_id = s.id)::int,
    (select count(*) from tours t where s.id = any (t.sight_ids) and t.status = 'active' and not t.admin_hidden)::int,
    (select count(*) from tours t where s.id = any (t.sight_ids) and t.status = 'active' and not t.admin_hidden
       and coalesce(t.end_date, t.date) >= current_date)::int,
    (select t.photo_urls[1] from tours t
      where s.id = any (t.sight_ids) and t.status = 'active' and not t.admin_hidden and cardinality(t.photo_urls) > 0
      order by t.date desc limit 1)
  from sights s
  where s.active;
$$;
grant execute on function public.sight_stats() to anon, authenticated;

-- 3) Hiker passports -----------------------------------------------------------------
alter table profiles add column if not exists show_passport boolean not null default false;

-- The places a person has been to: hikes they booked, that took place, and
-- where the club did not mark them absent. Readable for the person
-- themselves, or for anyone once they show their passport.
create or replace function public.passport_places(p_user uuid)
returns table (sight_id uuid, visits int, last_date date)
language sql
stable
security definer
set search_path = public
as $$
  select s.sight_id, count(*)::int, max(s.date)
  from (
    select unnest(t.sight_ids) as sight_id, t.date
    from bookings b join tours t on t.id = b.tour_id
    where b.user_id = p_user and b.status = 'confirmed' and b.attended is distinct from false
      and t.date <= current_date
  ) s
  where p_user = auth.uid()
     or exists (select 1 from profiles p where p.id = p_user and p.role = 'individual' and p.show_passport)
  group by s.sight_id;
$$;
grant execute on function public.passport_places(uuid) to anon, authenticated;

-- Everyone who shows a passport, with the counts the Hikers page lists. Only
-- the first name and the surname's initial leave the database.
create or replace function public.public_hikers()
returns table (
  user_id uuid, first_name text, last_initial text, photo_url text,
  hikes int, places int, mountains int, lakes int, heritage int, kinds int, regions int
)
language sql
stable
security definer
set search_path = public
as $$
  with went as (
    select b.user_id, t.id as tour_id, unnest(t.sight_ids) as sight_id
    from bookings b join tours t on t.id = b.tour_id
    join profiles p on p.id = b.user_id and p.role = 'individual' and p.show_passport and p.status = 'active'
    where b.status = 'confirmed' and b.attended is distinct from false and t.date <= current_date
  ), places as (
    select distinct w.user_id, w.sight_id, s.terrain, s.region from went w join sights s on s.id = w.sight_id
  )
  select p.id, p.first_name, left(coalesce(p.last_name, ''), 1), p.photo_url,
    (select count(distinct w.tour_id) from went w where w.user_id = p.id)::int,
    (select count(*) from places x where x.user_id = p.id)::int,
    (select count(*) from places x where x.user_id = p.id and x.terrain = 'mountains')::int,
    (select count(*) from places x where x.user_id = p.id and x.terrain = 'lakes')::int,
    (select count(*) from places x where x.user_id = p.id and x.terrain = 'heritage')::int,
    (select count(distinct x.terrain) from places x where x.user_id = p.id and x.terrain is not null and x.terrain <> 'other')::int,
    (select count(distinct x.region) from places x where x.user_id = p.id)::int
  from profiles p
  where p.role = 'individual' and p.show_passport and p.status = 'active';
$$;
grant execute on function public.public_hikers() to anon, authenticated;

-- 4) Saved searches ---------------------------------------------------------------------
create table if not exists saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  region text,
  sight_id uuid references sights (id) on delete cascade,
  terrain text,
  club_id uuid references clubs (id) on delete cascade,
  date_from date,
  date_to date,
  overnight boolean, -- null = either
  created_at timestamptz not null default now(),
  constraint saved_searches_something check (
    region is not null or sight_id is not null or terrain is not null or club_id is not null
    or date_from is not null or date_to is not null or overnight is not null
  ),
  constraint saved_searches_dates check (date_from is null or date_to is null or date_to >= date_from)
);
create index if not exists saved_searches_user_idx on saved_searches (user_id);
create index if not exists saved_searches_club_idx on saved_searches (club_id);
alter table saved_searches enable row level security;

drop policy if exists "People read their own searches" on saved_searches;
create policy "People read their own searches" on saved_searches
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Individuals save searches" on saved_searches;
create policy "Individuals save searches" on saved_searches
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'individual'));
drop policy if exists "People change their own searches" on saved_searches;
create policy "People change their own searches" on saved_searches
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "People delete their own searches" on saved_searches;
create policy "People delete their own searches" on saved_searches
  for delete to authenticated using (user_id = auth.uid());

-- At most five per person.
create or replace function public.limit_saved_searches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from saved_searches where user_id = new.user_id) >= 5 then
    raise exception 'Առավելագույնը 5 պահված որոնում։';
  end if;
  return new;
end;
$$;
drop trigger if exists on_saved_search_limit on saved_searches;
create trigger on_saved_search_limit before insert on saved_searches
  for each row execute function public.limit_saved_searches();

-- Follows become club-only saved searches (the first five per person).
insert into saved_searches (user_id, club_id, created_at)
select f.user_id, f.club_id, f.created_at
from (
  select fc.*, row_number() over (partition by fc.user_id order by fc.created_at) as n
  from favorite_clubs fc join profiles p on p.id = fc.user_id and p.role = 'individual'
) f
where f.n <= 5
  and not exists (select 1 from saved_searches s where s.user_id = f.user_id and s.club_id = f.club_id
                  and s.region is null and s.sight_id is null and s.terrain is null
                  and s.date_from is null and s.date_to is null and s.overnight is null);
delete from favorite_clubs;

-- A new published hike: one notice per person with a matching search.
create or replace function public.notify_favorites_on_new_tour()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;
  insert into notifications (user_id, club_id, tour_id, kind, sender_type, message)
  select distinct s.user_id, new.club_id, new.id, 'new_tour', 'club', new.title
  from saved_searches s
  where (s.region is null or s.region = any (new.regions))
    and (s.sight_id is null or s.sight_id = any (new.sight_ids))
    and (s.terrain is null or s.terrain = any (new.terrains))
    and (s.club_id is null or s.club_id = new.club_id)
    and (s.date_from is null or coalesce(new.end_date, new.date) >= s.date_from)
    and (s.date_to is null or new.date <= s.date_to)
    and (s.overnight is null or s.overnight = new.overnight);
  return new;
end;
$$;

-- 5) What the signed-in person has hearted and may heart ---------------------------------
create or replace function public.my_engagement()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tourLikes', coalesce((select jsonb_agg(tour_id) from tour_likes where user_id = auth.uid()), '[]'::jsonb),
    'sightLikes', coalesce((select jsonb_agg(sight_id) from sight_likes where user_id = auth.uid()), '[]'::jsonb),
    'attendedTours', coalesce((
      select jsonb_agg(distinct b.tour_id) from bookings b join tours t on t.id = b.tour_id
      where b.user_id = auth.uid() and b.status = 'confirmed' and b.attended is distinct from false and t.date <= current_date), '[]'::jsonb),
    'attendedSights', coalesce((
      select jsonb_agg(distinct x.sight_id) from (
        select unnest(t.sight_ids) as sight_id from bookings b join tours t on t.id = b.tour_id
        where b.user_id = auth.uid() and b.status = 'confirmed' and b.attended is distinct from false and t.date <= current_date
      ) x), '[]'::jsonb)
  );
$$;
