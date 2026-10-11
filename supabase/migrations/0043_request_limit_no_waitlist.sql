-- 0043: an admin can switch off one individual's custom requests, and the
-- "waitlist" plan flag is gone (the platform has no waitlist).
--
-- profiles.requests_blocked — the individual cannot leave new custom hike
-- requests; everything else keeps working. Like the other switches, only the
-- server flips it.

alter table profiles add column if not exists requests_blocked boolean not null default false;

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
      new.plan_overrides := case when tg_op = 'INSERT' then '{}'::jsonb else old.plan_overrides end;
    else
      new.booking_blocked := case when tg_op = 'INSERT' then false else old.booking_blocked end;
      new.requests_blocked := case when tg_op = 'INSERT' then false else old.requests_blocked end;
    end if;
  end if;
  return new;
end;
$$;

update packages set config = config - 'waitlist' where config ? 'waitlist';
update clubs set plan_overrides = plan_overrides - 'waitlist' where plan_overrides ? 'waitlist';
