-- 0032: custom tour requests, the sights list, and the cancel window per hike.
--
--   * tours.cancel_hours replaces clubs.cancel_hours (0031): some hikes refill
--     quickly, others need more notice, so the club sets it per listing.
--   * sights: the platform's list of places. Clubs tick them on a listing,
--     individuals on a request; admins manage the list.
--   * tour_requests: an individual describes the trip they want. Every club
--     can read the open ones; visitors and other individuals cannot.
--   * tour_offers: a club's answer (price, date, message). The individual
--     accepts one; the others are declined and the request closes.
-- Requests and offers are written by the server only (/api/requests), which
-- checks roles, packages and account status and keeps contact details out
-- of the free text.

-- 1) Cancel window per hike -----------------------------------------------------
alter table tours add column if not exists cancel_hours int not null default 48;
alter table tours drop constraint if exists tours_cancel_hours_check;
alter table tours add constraint tours_cancel_hours_check check (cancel_hours in (24, 36, 48, 60));

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'clubs' and column_name = 'cancel_hours') then
    update tours t set cancel_hours = c.cancel_hours from clubs c where c.id = t.club_id;
    alter table clubs drop constraint if exists clubs_cancel_hours_check;
    alter table clubs drop column cancel_hours;
  end if;
end $$;

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

-- 2) Sights -----------------------------------------------------------------------
create table if not exists sights (
  id uuid primary key default gen_random_uuid(),
  name_hy text not null,
  name_ru text not null,
  name_en text not null,
  region text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists sights_name_hy_key on sights (name_hy);
alter table sights enable row level security;
drop policy if exists "Sights are readable by everyone" on sights;
create policy "Sights are readable by everyone" on sights for select using (true);

alter table tours add column if not exists sight_ids uuid[] not null default '{}';

-- 3) Requests and offers ---------------------------------------------------------
create table if not exists tour_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  author_name text not null default '',     -- first name only; contacts open on acceptance
  people int not null check (people between 1 and 200),
  date_from date not null,
  date_to date not null,
  regions text[] not null default '{}',
  terrains text[] not null default '{}',
  sight_ids uuid[] not null default '{}',
  overnight boolean not null default false,
  budget int check (budget is null or budget >= 0),  -- AMD per person, optional
  note text,
  status text not null default 'open' check (status in ('open', 'accepted', 'closed')),
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);
create index if not exists tour_requests_status_created_idx on tour_requests (status, created_at desc);
create index if not exists tour_requests_user_idx on tour_requests (user_id, created_at desc);

create table if not exists tour_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references tour_requests (id) on delete cascade,
  club_id uuid not null references clubs (id) on delete cascade,
  price int not null check (price >= 0),    -- AMD per person
  date date not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (request_id, club_id)
);
create index if not exists tour_offers_club_idx on tour_offers (club_id, created_at desc);

alter table tour_requests enable row level security;
alter table tour_offers enable row level security;

-- The author always; every club while the request is open; afterwards only
-- the clubs that answered it.
drop policy if exists "Requests: author and clubs" on tour_requests;
create policy "Requests: author and clubs" on tour_requests
  for select using (
    user_id = auth.uid()
    or (status = 'open' and exists (select 1 from clubs c where c.owner_id = auth.uid()))
    or exists (
      select 1 from tour_offers o join clubs c on c.id = o.club_id
      where o.request_id = tour_requests.id and c.owner_id = auth.uid()
    )
  );

-- An offer is between its club and the request's author. The author lookup
-- is a security-definer function: the requests policy reads offers, so an
-- inline subquery here would recurse.
create or replace function public.owns_tour_request(p_request uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from tour_requests where id = p_request and user_id = auth.uid());
$$;
grant execute on function public.owns_tour_request(uuid) to authenticated;

drop policy if exists "Offers: the club and the author" on tour_offers;
create policy "Offers: the club and the author" on tour_offers
  for select using (
    exists (select 1 from clubs c where c.id = tour_offers.club_id and c.owner_id = auth.uid())
    or public.owns_tour_request(tour_offers.request_id)
  );
