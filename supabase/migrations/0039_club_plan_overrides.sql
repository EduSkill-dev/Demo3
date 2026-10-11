-- 0039: a single club can be given something its plan does not have.
--
-- clubs.plan_overrides holds only the capabilities the super admin changed
-- for that club (same keys as packages.config); everything else comes from
-- the club's plan. Only the server writes it. The two limits the database
-- enforces (listings, sign-ups per hike) now look at the club, not just at
-- its plan — the trigger bodies below are otherwise unchanged.

alter table clubs add column if not exists plan_overrides jsonb not null default '{}';

create or replace function public.club_max_listings(p_club uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((
    select coalesce((c.plan_overrides ->> 'max_active_tours')::int, tariff_max_listings(c.tariff))
    from clubs c where c.id = p_club and c.tariff is not null and c.package_ends_at > now()
  ), 0);
$$;

create or replace function public.club_max_participants(p_club uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((
    select coalesce((c.plan_overrides ->> 'max_participants_per_tour')::int, tariff_max_participants(c.tariff))
    from clubs c where c.id = p_club and c.tariff is not null and c.package_ends_at > now()
  ), 0);
$$;

revoke all on function public.club_max_listings(uuid) from public;
revoke all on function public.club_max_participants(uuid) from public;
grant execute on function public.club_max_listings(uuid) to anon, authenticated, service_role;
grant execute on function public.club_max_participants(uuid) to anon, authenticated, service_role;

-- A club cannot grant itself anything: the browser's value is thrown away.
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
    end if;
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.enforce_tour_listing_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tariff tariff := club_active_tariff(new.club_id);
  v_count int;
begin
  if new.status = 'cancelled' or new.date < current_date then
    return new;
  end if;

  if v_tariff is null then
    raise exception 'Հայտարարություն ավելացնելու համար ընտրեք փաթեթ։';
  end if;

  select count(*) into v_count from tours
  where club_id = new.club_id
    and status in ('active', 'hidden')
    and date >= current_date
    and id <> new.id;

  if v_count >= club_max_listings(new.club_id) then
    raise exception 'Հասել եք փաթեթի սահմանաչափին՝ % հայտարարություն։', club_max_listings(new.club_id);
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_booking_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tour record;
  v_role user_role;
  v_confirmed timestamptz;
  v_tariff tariff;
  v_limit int;
  v_taken int;
  v_existing uuid;
begin
  perform pg_advisory_xact_lock(hashtext(new.tour_id::text));

  select id, club_id, date, meeting_time, max_participants, status into v_tour
  from tours where id = new.tour_id;
  if not found then
    raise exception 'Արշավը չի գտնվել։';
  end if;

  if tg_op = 'INSERT' then
    select coalesce(max(seq), 0) + 1 into new.seq from bookings where tour_id = new.tour_id;
  end if;

  if tg_op = 'UPDATE' and old.status = 'confirmed' and new.status = 'cancelled' then
    if tour_starts_at(v_tour.date, v_tour.meeting_time) - now() < make_interval(hours => (select coalesce(t.cancel_hours, 48) from tours t where t.id = new.tour_id))
       and new.user_id is not null
       and coalesce(current_setting('highland.force_cancel', true), '') <> 'on' then
      raise exception 'Չեղարկել հնարավոր է միայն արշավից առնվազն % ժամ առաջ։', (select coalesce(t.cancel_hours, 48) from tours t where t.id = new.tour_id);
    end if;
    new.cancelled_at := coalesce(new.cancelled_at, now());
    return new;
  end if;

  if new.status is distinct from 'confirmed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' then
    return new;
  end if;

  new.cancelled_at := null;
  new.read_at := null;

  if v_tour.date < current_date then
    raise exception 'Այս արշավն արդեն տեղի է ունեցել։';
  end if;
  if v_tour.status <> 'active' then
    raise exception 'Այս արշավին գրանցումը փակ է։';
  end if;

  select role into v_role from profiles where id = new.user_id;
  if v_role = 'club' then
    raise exception 'Ակումբները չեն կարող գրանցվել արշավներին։';
  end if;

  select email_confirmed_at into v_confirmed from auth.users where id = new.user_id;
  if v_confirmed is null then
    raise exception 'Գրանցվելու համար նախ հաստատեք Ձեր էլ. հասցեն։';
  end if;

  select id into v_existing
  from bookings
  where tour_id = new.tour_id and user_id = new.user_id
    and status = 'confirmed' and id <> new.id;
  if v_existing is not null then
    raise exception 'Արդեն գրանցված եք այս արշավին։';
  end if;

  v_tariff := club_active_tariff(v_tour.club_id);
  if v_tariff is null then
    raise exception 'Այս արշավին գրանցումը ժամանակավորապես փակ է։';
  end if;
  v_limit := least(v_tour.max_participants, club_max_participants(v_tour.club_id));

  select count(*) into v_taken
  from bookings
  where tour_id = new.tour_id and status = 'confirmed' and id <> new.id;

  if v_taken >= v_limit then
    raise exception 'Տեղերը սպառված են (%/%)։', v_taken, v_limit;
  end if;

  return new;
end;
$function$;
