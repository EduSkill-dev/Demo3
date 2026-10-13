-- 0046: sharing on a social network can be closed for one club.
--
-- Two levels:
--   * site_settings.share_networks — the platform: a network that is off has
--     no button for anybody;
--   * clubs.share_blocked — the networks closed for this club alone: its
--     button stays visible but does not work.
-- Like the other admin switches, only the server writes it.

alter table clubs add column if not exists share_blocked text[] not null default '{}';

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
    else
      new.booking_blocked := case when tg_op = 'INSERT' then false else old.booking_blocked end;
      new.requests_blocked := case when tg_op = 'INSERT' then false else old.requests_blocked end;
    end if;
  end if;
  return new;
end;
$$;
