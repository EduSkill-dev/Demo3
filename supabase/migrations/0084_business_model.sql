-- 0084: the new business model (Gor's launch plan v2, decisions of 2026-10-31).
--   * Sign-up and listings are free. START is permanent and needs no renewal;
--     Advanced is the one paid plan, and when it lapses the club simply is on
--     START again. Nothing about a club's hikes depends on a plan any more.
--   * PRO is frozen: kept in the data, shown nowhere but to the super admin.
--   * Ratings and comments are public for every club.
--   * How many people a hike takes is the club's own number.
--   * Listings, two limits together (numbers in site_settings "business"):
--       - at most 30 published and not yet over at the same time;
--       - at most 30 published for one calendar month (the month of the hike's
--         first day). A cancelled or deleted listing does NOT give its place
--         back in the month; it does free the "at the same time" place.
--     Example: 30 published for this month, 10 already over on the 11th: 20
--     are running, so 10 more may go out for next month, leaving 20 for it.
--     Hidden listings are drafts and count for neither.

insert into public.site_settings (key, value) values ('business', jsonb_build_object(
  'listing_limit_month', 30,
  'listing_limit_active', 30,
  'platform_fee_percent', 5,
  'fee_includes_bank_fee', true,
  'promo_days', 90,
  'advanced_days', 30,
  'advanced_reminder_days', 3
)) on conflict (key) do nothing;

create or replace function public.business_setting(p_key text) returns numeric
language sql stable security definer set search_path = '' as $$
  select (value ->> p_key)::numeric from public.site_settings where key = 'business';
$$;
revoke all on function public.business_setting(text) from public, anon, authenticated;

/* ------------------------------------------------------------- plans */
alter table public.packages add column if not exists is_visible boolean not null default true;
update public.packages set is_visible = false, is_available = false where id = 'pro';

update public.packages set
  shows_ratings = true, shows_comments = true,
  config = config || jsonb_build_object(
    'public_show_rating', true, 'public_show_comments', true, 'share_buttons', true,
    'dashboard_registrants_list', true, 'dashboard_monthly_numbers', true)
  || case when id = 'start' then jsonb_build_object(
       'dashboard_comments_tab', false, 'registrants_csv_export', false, 'planner_other_clubs', false,
       'monthly_report', false, 'analytics', false)
     else jsonb_build_object(
       'dashboard_comments_tab', true, 'registrants_csv_export', true, 'planner_other_clubs', true,
       'monthly_report', true, 'analytics', true) end;
update public.packages set monthly_report = (config ->> 'monthly_report')::boolean, analytics = (config ->> 'analytics')::boolean;

-- The plan a club is on right now: a paid one while it runs, otherwise START.
create or replace function public.club_active_tariff(p_club uuid) returns public.tariff
language sql stable security definer set search_path = '' as $$
  select case when c.tariff is not null and c.tariff <> 'start' and c.package_ends_at > now()
              then c.tariff else 'start'::public.tariff end
  from public.clubs c where c.id = p_club;
$$;

-- One check for web and mobile alike: may this club use this feature? The
-- club's own exceptions come first, then its plan.
create or replace function public.club_has_feature(p_club uuid, p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (c.plan_overrides ->> p_feature)::boolean,
    (select (p.config ->> p_feature)::boolean from public.packages p where p.id = public.club_active_tariff(c.id)),
    false)
  from public.clubs c where c.id = p_club;
$$;
grant execute on function public.club_has_feature(uuid, text) to anon, authenticated;

/* ------------------------------------------------------------ capacity */
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
       and (new.user_id is not null or new.guest_id is not null)
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

  if new.user_id is not null then
    select role into v_role from profiles where id = new.user_id;
    if v_role = 'club' then
      raise exception 'Ակումբները չեն կարող գրանցվել արշավներին։';
    end if;
    select email_confirmed_at into v_confirmed from auth.users where id = new.user_id;
    if v_confirmed is null then
      raise exception 'Գրանցվելու համար նախ հաստատեք Ձեր էլ. հասցեն։';
    end if;
    select id into v_existing from bookings
    where tour_id = new.tour_id and user_id = new.user_id and status = 'confirmed' and id <> new.id;
  elsif new.guest_id is not null then
    select id into v_existing from bookings
    where tour_id = new.tour_id and guest_id = new.guest_id and status = 'confirmed' and id <> new.id;
  else
    raise exception 'Գրանցումը պետք է լինի հաշվով կամ հյուրի տվյալներով։';
  end if;
  if v_existing is not null then
    raise exception 'Արդեն գրանցված եք այս արշավին։';
  end if;

  -- How many people a hike takes is the club's own number, whatever its plan.
  v_limit := v_tour.max_participants;

  select count(*) into v_taken
  from bookings
  where tour_id = new.tour_id and status = 'confirmed' and id <> new.id;

  if v_taken >= v_limit then
    raise exception 'Տեղերը սպառված են (%/%)։', v_taken, v_limit;
  end if;

  return new;
end;
$function$;

alter table public.tours add constraint tours_max_participants_positive check (max_participants >= 1) not valid;

/* ------------------------------------------------------------ listings */
create table if not exists public.club_listing_counts (
  club_id uuid not null references public.clubs(id) on delete cascade,
  month date not null,            -- the first day of the month
  published integer not null default 0,
  primary key (club_id, month)
);
alter table public.club_listing_counts enable row level security;
drop policy if exists "A club reads its own counts" on public.club_listing_counts;
create policy "A club reads its own counts" on public.club_listing_counts for select
  using (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()));

-- The month a published listing holds a place in; null while it is a draft.
alter table public.tours add column if not exists counted_month date;

update public.tours set counted_month = date_trunc('month', date)::date
  where counted_month is null and status <> 'hidden';
insert into public.club_listing_counts (club_id, month, published)
  select club_id, counted_month, count(*) from public.tours where counted_month is not null group by 1, 2
  on conflict (club_id, month) do update set published = excluded.published;

create or replace function public.enforce_tour_publication() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Yerevan')::date;
  v_month date := date_trunc('month', new.date)::date;
  v_publishing boolean;
  v_moved boolean;
  v_count integer;
  v_limit integer;
begin
  -- Only this function sets it, whoever writes the row.
  new.counted_month := case when tg_op = 'INSERT' then null else old.counted_month end;

  if new.status <> 'active' then return new; end if;
  v_publishing := tg_op = 'INSERT' or old.status is distinct from 'active';
  v_moved := new.counted_month is not null and new.counted_month <> v_month;
  if not v_publishing and not v_moved then return new; end if;
  -- A hike already over takes no place (the club's own record of it).
  if coalesce(new.end_date, new.date) < v_today then return new; end if;

  perform pg_advisory_xact_lock(hashtext('listings:' || new.club_id::text));

  if v_publishing then
    v_limit := public.business_setting('listing_limit_active');
    select count(*) into v_count from public.tours t
      where t.club_id = new.club_id and t.status = 'active' and t.id <> new.id
        and coalesce(t.end_date, t.date) >= v_today;
    if v_count >= v_limit then
      raise exception 'listing_limit_active: Միաժամանակ կարող եք ունենալ առավելագույնը % հրապարակված հայտարարություն։', v_limit;
    end if;
  end if;

  if new.counted_month is null or v_moved then
    v_limit := public.business_setting('listing_limit_month');
    select coalesce(c.published, 0) into v_count from public.club_listing_counts c
      where c.club_id = new.club_id and c.month = v_month;
    if coalesce(v_count, 0) >= v_limit then
      raise exception 'listing_limit_month: Այս ամսվա համար արդեն հրապարակել եք առավելագույն թվով՝ % հայտարարություն։', v_limit;
    end if;
    insert into public.club_listing_counts (club_id, month, published) values (new.club_id, v_month, 1)
      on conflict (club_id, month) do update set published = public.club_listing_counts.published + 1;
    -- A date moved to another month takes its place with it.
    if v_moved then
      update public.club_listing_counts set published = greatest(published - 1, 0)
        where club_id = new.club_id and month = new.counted_month;
    end if;
    new.counted_month := v_month;
  end if;
  return new;
end $$;

drop trigger if exists on_tour_insert_enforce_tariff on public.tours;
drop trigger if exists on_tour_reactivate_enforce_tariff on public.tours;
drop trigger if exists on_tour_enforce_publication on public.tours;
create trigger on_tour_enforce_publication before insert or update on public.tours
  for each row execute function public.enforce_tour_publication();
