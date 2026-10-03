-- 0017: money-adjacent writes move to the server.
--
-- Before this, a signed-in browser could:
--   * insert a confirmed booking for a paid tour without paying,
--   * insert its own "succeeded" payments row,
--   * set its club's tariff to 'advanced' without paying,
--   * (as a club) flip a cancelled booking back to confirmed.
--
-- Now bookings, payments and clubs.tariff are written only by the Next.js
-- API routes using the service-role key. Browsers keep read access.

-- 1) Bookings: owners read, nobody writes from the client -----------------
drop policy if exists "Users manage their own bookings" on bookings;
drop policy if exists "Users read their own bookings" on bookings;
create policy "Users read their own bookings" on bookings
  for select using (auth.uid() = user_id);

drop policy if exists "Club owners update bookings on their tours" on bookings;
-- "Club owners read bookings on their tours" (0009) stays.

-- 2) Payments: read own, insert only from the server ----------------------
drop policy if exists "Users record their own payments" on payments;

-- 3) Tariff: only the server (service role) or SQL console may change it --
create or replace function public.guard_club_tariff()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if new.tariff not in ('start', 'advanced') then
    raise exception 'Այս տարիֆը դեռ հասանելի չէ։';
  end if;

  if v_role in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.tariff <> 'start' then
      raise exception 'Տարիֆը փոխվում է միայն վճարման միջոցով։';
    end if;
    if tg_op = 'UPDATE' and new.tariff is distinct from old.tariff then
      raise exception 'Տարիֆը փոխվում է միայն վճարման միջոցով։';
    end if;
  end if;

  return new;
end;
$$;

-- 4) One club per club account --------------------------------------------
create unique index if not exists clubs_owner_id_key on clubs (owner_id);

-- 5) Signing up never grants a paid tariff --------------------------------
-- The club signup form used to send `tariff` in the metadata, and the
-- trigger trusted it. Every new club now starts on START.
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
    insert into public.clubs (owner_id, name, tariff)
    values (new.id, coalesce(club_name_value, 'Նոր ակումբ'), 'start');
  end if;

  return new;
end;
$$;
