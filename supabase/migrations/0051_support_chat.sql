-- 0051: the help chat between a registered account and the admins.
--
-- support_messages  one row per message. The person writes on the Help page;
--   the server forwards it to the admins' Telegram group and stores the
--   Telegram message id, so an admin's reply there (to that message) finds
--   its way back here. A person reads only their own conversation; only the
--   server writes.
-- profiles.chat_blocked  an admin switched the chat off for this account
--   (individual or club owner). Like the other switches, only the server
--   flips it.

create table if not exists support_messages (
  id bigserial primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  from_admin boolean not null default false,
  admin_name text,                          -- who answered (as named in Telegram)
  body text not null check (char_length(body) between 1 and 1000),
  tg_message_id bigint,                     -- the copy of this message in the admins' group
  created_at timestamptz not null default now()
);
create index if not exists support_messages_user_idx on support_messages (user_id, id);
create index if not exists support_messages_tg_idx on support_messages (tg_message_id) where tg_message_id is not null;

alter table support_messages enable row level security;
drop policy if exists "People read their own help chat" on support_messages;
create policy "People read their own help chat" on support_messages
  for select using (auth.uid() = user_id);

alter table profiles add column if not exists chat_blocked boolean not null default false;

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
      new.share_blocked := case when tg_op = 'INSERT' then '{}'::text[] else old.share_blocked end;
      new.report_items := case when tg_op = 'INSERT' then null else old.report_items end;
    else
      new.booking_blocked := case when tg_op = 'INSERT' then false else old.booking_blocked end;
      new.requests_blocked := case when tg_op = 'INSERT' then false else old.requests_blocked end;
      new.chat_blocked := case when tg_op = 'INSERT' then false else old.chat_blocked end;
    end if;
  end if;
  return new;
end;
$$;
