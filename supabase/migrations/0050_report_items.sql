-- 0050: what a club's monthly report contains.
--
-- The list of possible report lines lives in code (src/lib/report/items.ts).
--   packages.report_items  what a plan's report shows by default
--                          (null = every line);
--   clubs.report_items     what this one club sees, set by an admin
--                          (null = follow the plan — "reset").
-- Only the server writes either.

alter table packages add column if not exists report_items text[];
alter table clubs add column if not exists report_items text[];

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
      new.share_blocked := case when tg_op = 'INSERT' then '{}'::text[] else old.share_blocked end;
      new.report_items := case when tg_op = 'INSERT' then null else old.report_items end;
    else
      new.booking_blocked := case when tg_op = 'INSERT' then false else old.booking_blocked end;
      new.requests_blocked := case when tg_op = 'INSERT' then false else old.requests_blocked end;
    end if;
  end if;
  return new;
end;
$$;
