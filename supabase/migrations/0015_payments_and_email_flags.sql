-- 0015: payments (mock gateway records) + the columns needed to email
-- followers exactly once per published tour.

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  club_id uuid references clubs (id) on delete cascade,
  tour_id uuid references tours (id) on delete set null,
  kind text not null check (kind in ('booking', 'subscription')),
  tariff tariff,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'AMD',
  status text not null check (status in ('succeeded', 'declined')),
  provider text not null default 'mock',
  card_last4 text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on payments (user_id, created_at desc);

alter table payments enable row level security;

-- People see their own receipts; the server route writes through the
-- session's own client, so no service key is needed for normal use.
drop policy if exists "Users read their own payments" on payments;
create policy "Users read their own payments" on payments
  for select using (auth.uid() = user_id);

drop policy if exists "Users record their own payments" on payments;
create policy "Users record their own payments" on payments
  for insert to authenticated with check (auth.uid() = user_id);

-- Which tour a notification is about, and whether its email went out.
-- The trigger below fills tour_id; emailed_at is the de-duplication guard so
-- a retried announcement never emails the same follower twice.
alter table notifications add column if not exists tour_id uuid references tours (id) on delete cascade;
alter table notifications add column if not exists emailed_at timestamptz;

create index if not exists notifications_tour_id_idx on notifications (tour_id);

-- Re-create the fan-out trigger so new rows carry tour_id.
create or replace function public.notify_favorites_on_new_tour()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  club_name_value text;
begin
  select name into club_name_value from clubs where id = new.club_id;

  insert into notifications (user_id, club_id, tour_id, message)
  select user_id, new.club_id, new.id,
    coalesce(club_name_value, 'Ակումբը') || ' հրապարակեց նոր արշավ՝ "' || new.title || '"'
  from favorite_clubs
  where club_id = new.club_id;

  return new;
end;
$$;

drop trigger if exists on_tour_created_notify_favorites on tours;
create trigger on_tour_created_notify_favorites
  after insert on tours
  for each row execute function public.notify_favorites_on_new_tour();
