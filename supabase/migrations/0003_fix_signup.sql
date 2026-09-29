-- Consolidated, safe-to-rerun fix. Run this once in the Supabase SQL editor —
-- it works no matter what you already ran before (0002_* files, if any).

-- 1) tour_type enum, only if it doesn't exist yet
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tour_type') then
    create type tour_type as enum ('mountain', 'lake', 'other');
  end if;
end $$;

-- 2) tour columns, only if missing
alter table tours add column if not exists type tour_type not null default 'mountain';
alter table tours add column if not exists overnight boolean not null default false;

-- 3) policies: drop old ones if present, recreate cleanly
drop policy if exists "Club owners manage their tours" on tours;
create policy "Club owners manage their tours" on tours
  for all using (
    exists (select 1 from clubs c where c.id = tours.club_id and c.owner_id = auth.uid())
  );

drop policy if exists "Club owners manage their club" on clubs;
create policy "Club owners manage their club" on clubs
  for all using (owner_id = auth.uid());

-- 4) the signup trigger — single source of truth, replaces any earlier version
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_role user_role := case when meta->>'role' = 'club' then 'club'::user_role else 'individual'::user_role end;
  chosen_tariff tariff := case when meta->>'tariff' = 'advanced' then 'advanced'::tariff else 'start'::tariff end;
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
    values (new.id, coalesce(club_name_value, 'Նոր ակումբ'), chosen_tariff);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
