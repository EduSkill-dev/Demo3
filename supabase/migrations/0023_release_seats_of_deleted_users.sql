-- 0023: a deleted person never keeps a seat.
--
-- Bookings keep their row when an account is deleted (user_id set to null,
-- 0021). /api/delete-account cancels upcoming bookings first, but an account
-- removed any other way (Supabase dashboard, admin API) left its bookings
-- "confirmed" and their seats taken. The capacity trigger now cancels a
-- booking the moment it loses its user, whatever the 48-hour rule says.

create or replace function public.release_seat_of_deleted_user()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null and old.user_id is not null and new.status = 'confirmed' then
    new.status := 'cancelled';
    new.cancelled_at := now();
    new.read_at := null; -- the club sees it as news
  end if;
  return new;
end;
$$;

-- Named to run before the capacity trigger ("on_booking_check_capacity"),
-- which then treats the row as an ordinary cancellation...
drop trigger if exists on_booking_aa_release_deleted_user on bookings;
create trigger on_booking_aa_release_deleted_user
  before update of user_id on bookings
  for each row execute function public.release_seat_of_deleted_user();

-- ...except for the 48-hour rule, which must not block an account deletion.
create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
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
    if tour_starts_at(v_tour.date, v_tour.meeting_time) - now() < interval '48 hours'
       and new.user_id is not null
       and coalesce(current_setting('highland.force_cancel', true), '') <> 'on' then
      raise exception 'Չեղարկել հնարավոր է միայն արշավից առնվազն 48 ժամ առաջ։';
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

-- Free the seats already held by deleted accounts.
do $$
begin
  perform set_config('highland.force_cancel', 'on', true);
  update bookings set status = 'cancelled' where user_id is null and status = 'confirmed';
end $$;
