-- Booking flow support:
--   * tariff limit helpers (single source of truth on the DB side, kept in
--     sync with TARIFF_LIMITS in src/types/database.ts)
--   * triggers that enforce the listing cap and the per-tour participant cap
--   * seats_taken() RPC so the public pages can show free seats without
--     exposing who signed up
--   * read/update access for club owners over bookings on their own tours

-- 1) Tariff helpers --------------------------------------------------------
create or replace function public.tariff_max_listings(p_tariff tariff)
returns int
language sql
immutable
as $$
  select case p_tariff
    when 'start' then 2
    when 'advanced' then 5
    else 1000000 -- pro: effectively unlimited
  end;
$$;

create or replace function public.tariff_max_participants(p_tariff tariff)
returns int
language sql
immutable
as $$
  select case p_tariff
    when 'start' then 5
    when 'advanced' then 20
    else 1000000 -- pro: effectively unlimited
  end;
$$;

revoke all on function public.tariff_max_listings(tariff) from public;
revoke all on function public.tariff_max_participants(tariff) from public;
grant execute on function public.tariff_max_listings(tariff) to anon, authenticated;
grant execute on function public.tariff_max_participants(tariff) to anon, authenticated;

-- 2) Listing cap: a club cannot publish more tours than its tariff allows ----
create or replace function public.enforce_tour_listing_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tariff tariff;
  v_count int;
begin
  select tariff into v_tariff from clubs where id = new.club_id;
  if v_tariff is null then
    return new;
  end if;

  select count(*) into v_count from tours where club_id = new.club_id;

  if v_count >= tariff_max_listings(v_tariff) then
    raise exception 'Հասել ես տարիֆի սահմանաչափին (%) հայտարարության։ Ջնջիր մեկը կամ բարձրացրու տարիֆդ։',
      v_tariff;
  end if;

  return new;
end;
$$;

drop trigger if exists on_tour_insert_enforce_tariff on tours;
create trigger on_tour_insert_enforce_tariff
  before insert on tours
  for each row execute function public.enforce_tour_listing_limit();

-- 3) Participant cap ------------------------------------------------------
create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tour record;
  v_limit int;
  v_taken int;
  v_existing uuid;
begin
  if new.status is distinct from 'confirmed' then
    return new;
  end if;

  select id, club_id, date, max_participants into v_tour
  from tours where id = new.tour_id;

  if not found then
    raise exception 'Արշավը չի գտնվել։';
  end if;

  if v_tour.date < current_date then
    raise exception 'Այս արշավն արդեն տեղի է ունեցել։';
  end if;

  -- Re-activating a previously cancelled signup is fine, but it still has to
  -- fit into the remaining seats.
  select id into v_existing
  from bookings
  where tour_id = new.tour_id and user_id = new.user_id
    and status = 'confirmed' and id <> new.id;

  if v_existing is not null then
    raise exception 'Արդեն գրանցված ես այս արշավին։';
  end if;

  select least(
    v_tour.max_participants,
    tariff_max_participants(c.tariff)
  ) into v_limit
  from clubs c where c.id = v_tour.club_id;

  select count(*) into v_taken
  from bookings
  where tour_id = new.tour_id and status = 'confirmed' and id <> new.id;

  if v_taken >= v_limit then
    raise exception 'Տեղերը լրացած են (%/%)։', v_taken, v_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists on_booking_check_capacity on bookings;
create trigger on_booking_check_capacity
  before insert or update on bookings
  for each row execute function public.enforce_booking_capacity();

-- 4) Public seat counter --------------------------------------------------
create or replace function public.seats_taken(p_tour uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.bookings
  where tour_id = p_tour and status = 'confirmed';
$$;

revoke all on function public.seats_taken(uuid) from public;
grant execute on function public.seats_taken(uuid) to anon, authenticated;

-- 5) Club owners: see and manage applicants for their own tours ------------
drop policy if exists "Club owners read bookings on their tours" on bookings;
create policy "Club owners read bookings on their tours" on bookings
  for select using (
    exists (
      select 1 from tours t
      join clubs c on c.id = t.club_id
      where t.id = bookings.tour_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Club owners update bookings on their tours" on bookings;
create policy "Club owners update bookings on their tours" on bookings
  for update using (
    exists (
      select 1 from tours t
      join clubs c on c.id = t.club_id
      where t.id = bookings.tour_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tours t
      join clubs c on c.id = t.club_id
      where t.id = bookings.tour_id and c.owner_id = auth.uid()
    )
  );

-- ...and the applicant profiles attached to those bookings (name, age,
-- gender, contact info) — and nothing else.
drop policy if exists "Club owners read applicant profiles" on profiles;
create policy "Club owners read applicant profiles" on profiles
  for select using (
    exists (
      select 1 from bookings b
      join tours t on t.id = b.tour_id
      join clubs c on c.id = t.club_id
      where b.user_id = profiles.id and c.owner_id = auth.uid()
    )
  );
