-- 0013: close the privilege-escalation gaps the E2E suite found.
-- Everything here is enforced in Postgres, so a modified client cannot get
-- around it:
--   * a profile's role is fixed at signup
--   * only a real club account may own a club row
--   * nobody may move a club to "pro" (it is not on sale yet)
--   * club accounts do not take part in tours

-- 1) Role is written once, by the signup trigger -------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Ակունտի դերը փոխելը հնարավոր չէ։';
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_role_protected on profiles;
create trigger on_profile_role_protected
  before update on profiles
  for each row execute function public.protect_profile_role();

-- 2) Only a club account may own a club ----------------------------------
drop policy if exists "Club owners manage their club" on clubs;
create policy "Club owners manage their club" on clubs
  for all using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'club'
    )
  );

-- 3) Pro stays disabled for everyone using the API -----------------------
create or replace function public.guard_club_tariff()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.tariff not in ('start', 'advanced') then
    raise exception 'Այս տարիֆը դեռ հասանելի չէ։';
  end if;
  return new;
end;
$$;

drop trigger if exists on_club_tariff_guard on clubs;
create trigger on_club_tariff_guard
  before insert or update on clubs
  for each row execute function public.guard_club_tariff();

-- 4) Clubs do not attend tours (extends the capacity trigger) ------------
create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tour record;
  v_role user_role;
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

  select role into v_role from profiles where id = new.user_id;
  if v_role = 'club' then
    raise exception 'Ակումբները չեն կարող գրանցվել արշավներին։';
  end if;

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
