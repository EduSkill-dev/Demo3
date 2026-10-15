-- 0061: suggestions get answers.
-- A confirmed suggestion is posted to the admins' "Culmen Suggestions"
-- Telegram group (tg_message_id = that post). An admin answers either there,
-- with Reply, or from the admin area; each answer is emailed to the author
-- and kept here, with who wrote it and from where. Only the server reads
-- and writes these (service role); no policies.
alter table contact_messages add column if not exists tg_message_id bigint;
create index if not exists contact_messages_tg_idx on contact_messages (tg_message_id) where tg_message_id is not null;

create table if not exists contact_replies (
  id bigserial primary key,
  message_id uuid not null references contact_messages (id) on delete cascade,
  admin_name text not null,
  body text not null check (char_length(body) between 1 and 4000),
  via text not null default 'site' check (via in ('site', 'telegram')),
  tg_message_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists contact_replies_message_idx on contact_replies (message_id, id);
alter table contact_replies enable row level security;

-- Help-chat answers remember where they were written too.
alter table support_messages add column if not exists via text not null default 'telegram' check (via in ('site', 'telegram'));
