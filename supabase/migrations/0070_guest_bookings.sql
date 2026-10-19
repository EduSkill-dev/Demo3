-- 0070: booking without an account (Gor, 2026-10-19). Someone who comes by a
-- shared link presses "Book" and fills in what we and the club need — name,
-- surname, phone, email, birth date, gender — without a password. Those
-- details are a "guest" (kept for the club and for us); the booking points to
-- the guest instead of an account. Ticking "create an account" also signs the
-- person up: once they confirm their email, their guest bookings move to the
-- account (trigger on auth.users below). A guest cancels through the secret
-- link in the confirmation email (bookings.cancel_token).

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and length(email) <= 254),
  first_name text not null check (length(first_name) between 1 and 60),
  last_name text not null check (length(last_name) between 1 and 60),
  phone text not null check (phone ~ '^[+0-9 ()-]{8,20}$'),
  birth_date date not null check (birth_date between date '1900-01-01' and current_date),
  gender text not null check (gender in ('male', 'female')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Stored lower-case, one guest per address.
alter table public.guests drop constraint if exists guests_email_lower;
alter table public.guests add constraint guests_email_lower check (email = lower(email));
drop index if exists public.guests_email_key;
create unique index if not exists guests_email_key on public.guests (email);
alter table public.guests enable row level security;
alter table public.bookings add column if not exists guest_id uuid references public.guests(id) on delete set null;
alter table public.bookings add column if not exists cancel_token uuid not null default gen_random_uuid();
create unique index if not exists bookings_cancel_token_key on public.bookings (cancel_token);
create unique index if not exists bookings_tour_guest_key on public.bookings (tour_id, guest_id) where guest_id is not null;
alter table public.payments add column if not exists guest_id uuid references public.guests(id) on delete set null;

-- The club running a hike sees its guests, as it sees its participants' profiles.
drop policy if exists "Club owners read guests of their tours" on public.guests;
create policy "Club owners read guests of their tours" on public.guests for select using (
  exists (select 1 from public.bookings b join public.tours t on t.id = b.tour_id join public.clubs c on c.id = t.club_id
          where b.guest_id = guests.id and c.owner_id = auth.uid())
);


-- The capacity and sign-up rules, now for a guest too: a confirmed booking
-- belongs to an account or a guest; a guest needs no confirmed email (the
-- server checked the details) and keeps the cancel window like everyone.
create or replace function public.enforce_booking_capacity()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

-- Confirming the email of a new account adopts that person's guest bookings
-- (and payments): from then on they see them in their own account.
create or replace function public.adopt_guest_bookings()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_guest uuid;
begin
  if new.email_confirmed_at is null or (tg_op = 'UPDATE' and old.email_confirmed_at is not null) then
    return new;
  end if;
  select id into v_guest from public.guests where email = lower(new.email);
  if v_guest is null then return new; end if;
  -- A hike the account already has a booking for keeps that one.
  update public.bookings b set user_id = new.id, guest_id = null
   where b.guest_id = v_guest
     and not exists (select 1 from public.bookings o where o.tour_id = b.tour_id and o.user_id = new.id);
  update public.payments set user_id = new.id, guest_id = null where guest_id = v_guest;
  return new;
end $$;
drop trigger if exists adopt_guest_bookings on auth.users;
create trigger adopt_guest_bookings after insert or update of email_confirmed_at on auth.users
  for each row execute function public.adopt_guest_bookings();
