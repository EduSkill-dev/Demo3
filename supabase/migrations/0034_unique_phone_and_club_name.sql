-- 0034: one phone number per account and one club per name.
--
-- Phone numbers are compared by their digits, so "+374 99 123456",
-- "099 123456" and "99123456" are the same number. Club names are compared
-- without regard to case or extra spaces. The sign-up pages ask first
-- (/api/auth/check-signup) to show a friendly message; the triggers below
-- are what actually guarantees it, also when a phone or name is edited later.

create or replace function public.phone_key(p text)
returns text
language sql immutable
as $$
  select case
    when d = '' then null
    when d like '374%' then d
    when d like '0%' and length(d) = 9 then '374' || substr(d, 2)
    when length(d) = 8 then '374' || d
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

create or replace function public.club_name_key(p text)
returns text
language sql immutable
as $$
  select lower(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g'));
$$;

create index if not exists profiles_phone_key_idx on profiles (public.phone_key(phone));
create index if not exists clubs_phone_key_idx on clubs (public.phone_key(phone));
create index if not exists clubs_name_key_idx on clubs (public.club_name_key(name));

-- Is the number used by an account other than p_owner? (An account's own
-- profile and club may share a number.)
create or replace function public.phone_in_use(p_phone text, p_owner uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select phone_key(p_phone) is not null and (
    exists (select 1 from profiles where phone_key(phone) = phone_key(p_phone) and id is distinct from p_owner)
    or exists (select 1 from clubs where phone_key(phone) = phone_key(p_phone) and owner_id is distinct from p_owner)
  );
$$;

create or replace function public.club_name_in_use(p_name text, p_owner uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select club_name_key(p_name) <> '' and exists (
    select 1 from clubs where club_name_key(name) = club_name_key(p_name) and owner_id is distinct from p_owner
  );
$$;

revoke all on function public.phone_in_use(text, uuid) from public, anon, authenticated;
revoke all on function public.club_name_in_use(text, uuid) from public, anon, authenticated;
grant execute on function public.phone_in_use(text, uuid) to service_role;
grant execute on function public.club_name_in_use(text, uuid) to service_role;

create or replace function public.guard_unique_contact()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_phone_changed boolean := true;
  v_name_changed boolean := true;
begin
  -- OLD exists only on UPDATE, and a clubs-only column only on clubs, so each
  -- is read inside its own branch.
  if tg_table_name = 'clubs' then
    v_owner := new.owner_id;
    if tg_op = 'UPDATE' then
      v_name_changed := club_name_key(new.name) is distinct from club_name_key(old.name);
    end if;
  else
    v_owner := new.id;
    v_name_changed := false;
  end if;
  if tg_op = 'UPDATE' then
    v_phone_changed := phone_key(new.phone) is distinct from phone_key(old.phone);
  end if;

  if new.phone is not null and v_phone_changed and phone_in_use(new.phone, v_owner) then
    raise exception 'Այս հեռախոսահամարն արդեն գրանցված է․ խնդրում ենք տրամադրել այլ հեռախոսահամար։';
  end if;
  if v_name_changed then
    if club_name_in_use(new.name, v_owner) then
      raise exception 'Այս անունով ակումբ արդեն գրանցված է․ խնդրում ենք ընտրել այլ անուն։';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_guard_unique_contact on profiles;
create trigger on_profile_guard_unique_contact
  before insert or update on profiles
  for each row execute function public.guard_unique_contact();
drop trigger if exists on_club_guard_unique_contact on clubs;
create trigger on_club_guard_unique_contact
  before insert or update on clubs
  for each row execute function public.guard_unique_contact();
