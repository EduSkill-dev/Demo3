-- 0014: fix the recursion the E2E suite caught in 0013.
--
-- 0013's clubs policy asked profiles for the caller's role, and the profiles
-- policy for applicant visibility asks clubs — Postgres reported
--   "infinite recursion detected in policy for relation clubs"
-- which broke saving a club's description/orientation/photo.
--
-- Same guarantee, no cycle: the role check now lives in a security-definer
-- trigger, which reads profiles without going through its policies.

drop policy if exists "Club owners manage their club" on clubs;
create policy "Club owners manage their club" on clubs
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create or replace function public.guard_club_ownership()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Signup trigger and the service role run without an interactive user;
  -- anon never reaches here because of the policy above.
  if auth.uid() is null then
    return new;
  end if;

  if not exists (
    select 1 from profiles
    where id = auth.uid() and role = 'club'
  ) then
    if tg_op = 'INSERT' then
      raise exception 'Ակումբ կարող են ստեղծել միայն ակումբային հաշիվները։';
    end if;
    raise exception 'Այս ակումբը խմբագրելու իրավունք չունես։';
  end if;

  return new;
end;
$$;

drop trigger if exists on_club_guard_ownership on clubs;
create trigger on_club_guard_ownership
  before insert or update on clubs
  for each row execute function public.guard_club_ownership();
