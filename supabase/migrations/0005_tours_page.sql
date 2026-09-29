-- Difficulty + "popular" flag for tours, and two public-facing intake tables:
-- newsletter subscribers and contact/suggestion messages.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'difficulty') then
    create type difficulty as enum ('easy', 'medium', 'hard', 'prof');
  end if;
end $$;

alter table tours add column if not exists difficulty difficulty not null default 'medium';
alter table tours add column if not exists popular boolean not null default false;

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  email text not null,
  phone text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table newsletter_subscribers enable row level security;
alter table contact_messages enable row level security;

-- Anyone can submit; nobody (besides an admin using the service role key
-- later) can read these back through the public API.
drop policy if exists "Anyone can subscribe" on newsletter_subscribers;
create policy "Anyone can subscribe" on newsletter_subscribers
  for insert to anon, authenticated with check (true);

drop policy if exists "Anyone can send a message" on contact_messages;
create policy "Anyone can send a message" on contact_messages
  for insert to anon, authenticated with check (true);
