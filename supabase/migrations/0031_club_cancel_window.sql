-- 0031: each club decides how long before a hike a booking can still be
-- cancelled: 24, 36, 48 (the default, and the rule until now) or 60 hours.
-- The setting applies to all of the club's hikes, existing bookings included.

alter table clubs add column if not exists cancel_hours int not null default 48;
alter table clubs drop constraint if exists clubs_cancel_hours_check;
alter table clubs add constraint clubs_cancel_hours_check check (cancel_hours in (24, 36, 48, 60));

-- The booking trigger as it stood in 0023, with the club's window in place of
-- the fixed 48 hours.
CREATE OR REPLACE FUNCTION public.enforce_booking_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
    if tour_starts_at(v_tour.date, v_tour.meeting_time) - now() < make_interval(hours => (select coalesce(c.cancel_hours, 48) from clubs c where c.id = v_tour.club_id))
       and new.user_id is not null
       and coalesce(current_setting('highland.force_cancel', true), '') <> 'on' then
      raise exception 'Չեղարկել հնարավոր է միայն արշավից առնվազն % ժամ առաջ։', (select coalesce(c.cancel_hours, 48) from clubs c where c.id = v_tour.club_id);
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
  v_limit := least(v_tour.max_participants, tariff_max_participants(v_tariff));

  select count(*) into v_taken
  from bookings
  where tour_id = new.tour_id and status = 'confirmed' and id <> new.id;

  if v_taken >= v_limit then
    raise exception 'Տեղերը սպառված են (%/%)։', v_taken, v_limit;
  end if;

  return new;
end;
$$;
