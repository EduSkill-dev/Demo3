-- 0029: switches an admin can force off for one account, whatever its package:
--   * clubs.posting_blocked       — the club cannot add new listings
--   * clubs.applications_blocked  — nobody new can sign up for its hikes
--   * profiles.booking_blocked    — the individual cannot sign up for hikes
-- Everything else about the account keeps working. Only the server flips them.

alter table clubs add column if not exists posting_blocked boolean not null default false;
alter table clubs add column if not exists applications_blocked boolean not null default false;
alter table profiles add column if not exists booking_blocked boolean not null default false;

create or replace function public.guard_admin_limits()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    if tg_table_name = 'clubs' then
      new.posting_blocked := case when tg_op = 'INSERT' then false else old.posting_blocked end;
      new.applications_blocked := case when tg_op = 'INSERT' then false else old.applications_blocked end;
    else
      new.booking_blocked := case when tg_op = 'INSERT' then false else old.booking_blocked end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_club_guard_admin_limits on clubs;
create trigger on_club_guard_admin_limits
  before insert or update on clubs
  for each row execute function public.guard_admin_limits();
drop trigger if exists on_profile_guard_admin_limits on profiles;
create trigger on_profile_guard_admin_limits
  before insert or update on profiles
  for each row execute function public.guard_admin_limits();

-- No new listings for a club whose posting was switched off.
create or replace function public.guard_club_posting()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from clubs where id = new.club_id and posting_blocked) then
    raise exception 'Նոր հայտարարություն ավելացնելու հնարավորությունն անջատված է ադմինիստրատորի կողմից։';
  end if;
  return new;
end;
$$;

drop trigger if exists on_tour_guard_club_posting on tours;
create trigger on_tour_guard_club_posting
  before insert on tours
  for each row execute function public.guard_club_posting();

-- New sign-ups: not on a tour an admin took down, not for a club or a person
-- whose sign-ups were switched off, and only individuals book.
create or replace function public.guard_booking_admin_rules()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    if exists (select 1 from tours where id = new.tour_id and admin_hidden) then
      raise exception 'Այս արշավին գրանցումը փակ է։';
    end if;
    if exists (select 1 from tours t join clubs c on c.id = t.club_id where t.id = new.tour_id and c.applications_blocked) then
      raise exception 'Այս ակումբի արշավներին գրանցումը ժամանակավորապես փակ է։';
    end if;
    if exists (select 1 from profiles where id = new.user_id and role <> 'individual') then
      raise exception 'Այս հաշվով արշավի գրանցվել հնարավոր չէ։';
    end if;
    if exists (select 1 from profiles where id = new.user_id and booking_blocked) then
      raise exception 'Արշավներին գրանցվելու հնարավորությունն անջատված է ադմինիստրատորի կողմից։';
    end if;
  end if;
  return new;
end;
$$;
