-- Highland — initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push` once the
-- Supabase CLI is set up.

create type user_role as enum ('individual', 'club');
create type tariff as enum ('start', 'advanced', 'pro');
create type booking_status as enum ('confirmed', 'cancelled');

-- One row per auth.users entry, holding the fields our forms collect.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'individual',
  first_name text,
  last_name text,
  age int,
  gender text,
  email text not null,
  created_at timestamptz not null default now()
);

create table clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  tariff tariff not null default 'start',
  created_at timestamptz not null default now()
);

create table tours (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  title text not null,
  description text,
  region text not null,
  date date not null,
  max_participants int not null,
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status booking_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  unique (tour_id, user_id)
);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  tour_id uuid references tours (id) on delete cascade,
  club_id uuid references clubs (id) on delete cascade,
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  check (tour_id is not null or club_id is not null)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  club_id uuid not null references clubs (id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Individuals' favorite clubs (many-to-many).
create table favorite_clubs (
  user_id uuid not null references profiles (id) on delete cascade,
  club_id uuid not null references clubs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, club_id)
);

-- Row Level Security — enable and add policies before going to production.
alter table profiles enable row level security;
alter table clubs enable row level security;
alter table tours enable row level security;
alter table bookings enable row level security;
alter table ratings enable row level security;
alter table notifications enable row level security;
alter table favorite_clubs enable row level security;

-- Starting policies: everyone can read tours/clubs; users manage their own rows.
-- Tighten these as you build out each feature.
create policy "Tours are readable by everyone" on tours for select using (true);
create policy "Clubs are readable by everyone" on clubs for select using (true);
create policy "Users manage their own profile" on profiles
  for all using (auth.uid() = id);
create policy "Users manage their own bookings" on bookings
  for all using (auth.uid() = user_id);
create policy "Users manage their own favorites" on favorite_clubs
  for all using (auth.uid() = user_id);

-- Tariff limits (max listings, max participants) are enforced in the app
-- layer via TARIFF_LIMITS in src/types/database.ts, not here — this keeps
-- the limits editable in one place without a migration.
