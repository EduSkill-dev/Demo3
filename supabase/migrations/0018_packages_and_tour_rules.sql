-- 0018: the package model and the tour/booking rules everything else builds on.
--
--   * packages table: START 2/5 (free), Advanced 5/10 (20 000 ֏), PRO 20/20
--     (40 000 ֏). The SQL limit helpers read it; src/lib/catalog.ts mirrors it
--     and the e2e suite checks the two never drift.
--   * clubs.tariff is now "the package bought", clubs.package_ends_at is when
--     it lapses. A new club has no package. An expired package counts as none.
--   * tours: status (active / hidden / cancelled) and terrains[] replace the
--     single `type`; the per-tour cancel deadline is gone (fixed 48 h).
--   * bookings: seq (k in "k/B", fixed at arrival), read_at, cancelled_at.
--   * a booking needs a confirmed email, an active tour of a club with an
--     active package, and a free seat; cancelling needs > 48 h to go.
--   * ratings only after the tour has happened.

-- 1) Packages --------------------------------------------------------------
create table if not exists packages (
  id tariff primary key,
  name text not null,
  max_listings int not null,
  max_per_tour int not null,
  price_amd int not null,
  shows_ratings boolean not null,
  shows_comments boolean not null,
  monthly_report boolean not null,
  analytics boolean not null,
  sort int not null
);

insert into packages (id, name, max_listings, max_per_tour, price_amd, shows_ratings, shows_comments, monthly_report, analytics, sort)
values
  ('start',    'START',    2,  5,  0,     false, false, false, false, 1),
  ('advanced', 'Advanced', 5,  10, 20000, true,  true,  true,  false, 2),
  ('pro',      'PRO',      20, 20, 40000, true,  true,  true,  true,  3)
on conflict (id) do update set
  name = excluded.name, max_listings = excluded.max_listings,
  max_per_tour = excluded.max_per_tour, price_amd = excluded.price_amd,
  shows_ratings = excluded.shows_ratings, shows_comments = excluded.shows_comments,
  monthly_report = excluded.monthly_report, analytics = excluded.analytics,
  sort = excluded.sort;

alter table packages enable row level security;
drop policy if exists "Packages are readable by everyone" on packages;
create policy "Packages are readable by everyone" on packages for select using (true);

create or replace function public.tariff_max_listings(p_tariff tariff)
returns int language sql stable as $$
  select coalesce((select max_listings from packages where id = p_tariff), 0);
$$;

create or replace function public.tariff_max_participants(p_tariff tariff)
returns int language sql stable as $$
  select coalesce((select max_per_tour from packages where id = p_tariff), 0);
$$;

-- 2) Clubs: package + expiry ------------------------------------------------
alter table clubs alter column tariff drop not null;
alter table clubs alter column tariff drop default;
alter table clubs add column if not exists package_ends_at timestamptz;

-- Existing (test) clubs keep their tariff for one month from today.
update clubs set package_ends_at = now() + interval '1 month'
where tariff is not null and package_ends_at is null;

-- The package a club can use right now (null = none or expired).
create or replace function public.club_active_tariff(p_club uuid)
returns tariff
language sql stable security definer set search_path = public
as $$
  select tariff from clubs
  where id = p_club and tariff is not null and package_ends_at > now();
$$;
grant execute on function public.club_active_tariff(uuid) to anon, authenticated;

-- Only the server (service role) or the SQL console may change the package.
create or replace function public.guard_club_tariff()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if v_role in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and (new.tariff is not null or new.package_ends_at is not null) then
      raise exception 'Փաթեթը ակտիվանում է միայն վահանակից։';
    end if;
    if tg_op = 'UPDATE' and (
      new.tariff is distinct from old.tariff
      or new.package_ends_at is distinct from old.package_ends_at
    ) then
      raise exception 'Փաթեթը փոխվում է միայն վճարման միջոցով։';
    end if;
  end if;
  return new;
end;
$$;

-- New clubs start without a package.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_role user_role := case when meta->>'role' = 'club' then 'club'::user_role else 'individual'::user_role end;
  club_name_value text := nullif(trim(meta->>'club_name'), '');
  profile_age int;
begin
  begin
    profile_age := nullif(meta->>'age', '')::int;
  exception when others then
    profile_age := null;
  end;

  insert into public.profiles (id, role, first_name, last_name, age, gender, email)
  values (
    new.id, new_role,
    nullif(meta->>'first_name', ''), nullif(meta->>'last_name', ''),
    profile_age, nullif(meta->>'gender', ''), coalesce(new.email, '')
  );

  if new_role = 'club' then
    insert into public.clubs (owner_id, name)
    values (new.id, coalesce(club_name_value, 'Նոր ակումբ'));
  end if;

  return new;
end;
$$;

-- Subscription payments remember the period they paid for.
alter table payments add column if not exists period_start timestamptz;
alter table payments add column if not exists period_end timestamptz;

-- 3) Tours: status, terrains, fixed 48 h cancel window -----------------------
alter table tours add column if not exists status text not null default 'active';
alter table tours drop constraint if exists tours_status_check;
alter table tours add constraint tours_status_check check (status in ('active', 'hidden', 'cancelled'));

alter table tours add column if not exists terrains text[] not null default '{}';
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'tours' and column_name = 'type') then
    update tours set terrains = case type::text
      when 'mountain' then array['mountains']
      when 'lake' then array['lakes']
      else array['other'] end
    where terrains = '{}';
    alter table tours drop column type;
  end if;
end $$;
drop type if exists tour_type;

alter table tours drop column if exists cancel_deadline_hours;

-- Tour start in Armenian time (date + meeting time, midnight if unset).
create or replace function public.tour_starts_at(p_date date, p_time time)
returns timestamptz language sql immutable as $$
  select (p_date + coalesce(p_time, time '00:00')) at time zone 'Asia/Yerevan';
$$;

-- Hidden and cancelled tours are visible only to their club and to people
-- who booked them. The booking lookup is a security-definer function: the
-- bookings policies read tours, so an inline subquery would recurse.
create or replace function public.has_booked_tour(p_tour uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from bookings where tour_id = p_tour and user_id = auth.uid());
$$;
grant execute on function public.has_booked_tour(uuid) to anon, authenticated;

drop policy if exists "Tours are readable by everyone" on tours;
create policy "Tours are readable by everyone" on tours
  for select using (
    status = 'active'
    or exists (select 1 from clubs c where c.id = tours.club_id and c.owner_id = auth.uid())
    or public.has_booked_tour(tours.id)
  );

-- Listing cap: upcoming active + hidden tours count; past and cancelled don't.
create or replace function public.enforce_tour_listing_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tariff tariff := club_active_tariff(new.club_id);
  v_count int;
begin
  if new.status = 'cancelled' or new.date < current_date then
    return new;
  end if;

  if v_tariff is null then
    raise exception 'Հայտարարություն ավելացնելու համար ընտրեք փաթեթ։';
  end if;

  select count(*) into v_count from tours
  where club_id = new.club_id
    and status in ('active', 'hidden')
    and date >= current_date
    and id <> new.id;

  if v_count >= tariff_max_listings(v_tariff) then
    raise exception 'Հասել եք փաթեթի սահմանաչափին՝ % հայտարարություն։', tariff_max_listings(v_tariff);
  end if;

  return new;
end;
$$;

-- Re-check when a cancelled or past tour is brought back into play.
drop trigger if exists on_tour_insert_enforce_tariff on tours;
create trigger on_tour_insert_enforce_tariff
  before insert on tours
  for each row execute function public.enforce_tour_listing_limit();

drop trigger if exists on_tour_reactivate_enforce_tariff on tours;
create trigger on_tour_reactivate_enforce_tariff
  before update of status, date on tours
  for each row
  when (
    (old.status = 'cancelled' and new.status <> 'cancelled')
    or (old.date < current_date and new.date >= current_date)
  )
  execute function public.enforce_tour_listing_limit();

-- 4) Bookings: seq, read_at, cancelled_at + the rules -----------------------
alter table bookings add column if not exists seq int;
alter table bookings add column if not exists read_at timestamptz;
alter table bookings add column if not exists cancelled_at timestamptz;

update bookings b set seq = x.rn
from (
  select id, row_number() over (partition by tour_id order by created_at, id) as rn
  from bookings
) x
where x.id = b.id and b.seq is null;

update bookings set cancelled_at = created_at
where status = 'cancelled' and cancelled_at is null;

create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tour record;
  v_role user_role;
  v_confirmed timestamptz;
  v_tariff tariff;
  v_limit int;
  v_taken int;
  v_existing uuid;
begin
  -- Serialise bookings per tour, so two people never get the last seat.
  perform pg_advisory_xact_lock(hashtext(new.tour_id::text));

  select id, club_id, date, meeting_time, max_participants, status into v_tour
  from tours where id = new.tour_id;
  if not found then
    raise exception 'Արշավը չի գտնվել։';
  end if;

  if tg_op = 'INSERT' then
    select coalesce(max(seq), 0) + 1 into new.seq from bookings where tour_id = new.tour_id;
  end if;

  -- Cancelling: only while more than 48 hours remain.
  if tg_op = 'UPDATE' and old.status = 'confirmed' and new.status = 'cancelled' then
    if tour_starts_at(v_tour.date, v_tour.meeting_time) - now() < interval '48 hours' then
      raise exception 'Չեղարկել հնարավոր է միայն արշավից առնվազն 48 ժամ առաջ։';
    end if;
    new.cancelled_at := now();
    return new;
  end if;

  if new.status is distinct from 'confirmed' then
    return new;
  end if;
  -- Already confirmed and staying confirmed (e.g. read_at changes): no checks.
  if tg_op = 'UPDATE' and old.status = 'confirmed' then
    return new;
  end if;

  -- From here: a new or re-activated signup.
  new.cancelled_at := null;
  new.read_at := null;

  if v_tour.date < current_date then
    raise exception 'Այս արշավն արդեն տեղի է ունեցել։';
  end if;
  if v_tour.status <> 'active' then
    raise exception 'Այս արշավին գրանցումը փակ է։';
  end if;

  select role into v_role from profiles where id = new.user_id;
  if v_role = 'club' then
    raise exception 'Ակումբները չեն կարող գրանցվել արշավներին։';
  end if;

  select email_confirmed_at into v_confirmed from auth.users where id = new.user_id;
  if v_confirmed is null then
    raise exception 'Գրանցվելու համար նախ հաստատեք Ձեր էլ. հասցեն։';
  end if;

  select id into v_existing
  from bookings
  where tour_id = new.tour_id and user_id = new.user_id
    and status = 'confirmed' and id <> new.id;
  if v_existing is not null then
    raise exception 'Արդեն գրանցված եք այս արշավին։';
  end if;

  v_tariff := club_active_tariff(v_tour.club_id);
  if v_tariff is null then
    raise exception 'Այս արշավին գրանցումը ժամանակավորապես փակ է։';
  end if;
  v_limit := least(v_tour.max_participants, tariff_max_participants(v_tariff));

  select count(*) into v_taken
  from bookings
  where tour_id = new.tour_id and status = 'confirmed' and id <> new.id;

  if v_taken >= v_limit then
    raise exception 'Տեղերը սպառված են (%/%)։', v_taken, v_limit;
  end if;

  return new;
end;
$$;

-- The club marks an application as read when it opens it.
create or replace function public.mark_booking_read(p_booking uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update bookings b set read_at = now()
  where b.id = p_booking and b.read_at is null
    and exists (
      select 1 from tours t join clubs c on c.id = t.club_id
      where t.id = b.tour_id and c.owner_id = auth.uid()
    );
end;
$$;
revoke all on function public.mark_booking_read(uuid) from public;
grant execute on function public.mark_booking_read(uuid) to authenticated;

-- 5) Ratings only after the tour ---------------------------------------------
drop policy if exists "Only attendees can rate a club" on ratings;
create policy "Only attendees can rate a club" on ratings
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      (club_id is not null and exists (
        select 1 from bookings b
        join tours t on t.id = b.tour_id
        where b.user_id = auth.uid() and t.club_id = ratings.club_id
          and b.status = 'confirmed' and t.date <= current_date
      ))
      or
      (tour_id is not null and exists (
        select 1 from bookings b
        join tours t on t.id = b.tour_id
        where b.user_id = auth.uid() and b.tour_id = ratings.tour_id
          and b.status = 'confirmed' and t.date <= current_date
      ))
    )
  );

-- 6) Regions are stored as stable keys; labels live in the UI dictionaries
--    (hy / ru / en).
update tours set regions = array(
  select case r
    when 'Երևան' then 'yerevan'
    when 'Արագածոտն' then 'aragatsotn'
    when 'Արարատ' then 'ararat'
    when 'Արմավիր' then 'armavir'
    when 'Գեղարքունիք' then 'gegharkunik'
    when 'Կոտայք' then 'kotayk'
    when 'Լոռի' then 'lori'
    when 'Շիրակ' then 'shirak'
    when 'Սյունիք' then 'syunik'
    when 'Վայոց ձոր' then 'vayots_dzor'
    when 'Տավուշ' then 'tavush'
    else r end
  from unnest(regions) r
);
