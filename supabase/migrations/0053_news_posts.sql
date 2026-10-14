-- 0053: posts to the clubs' news channel in Telegram.
--
-- Admins with the "news" permission (the super admin always) write a post
-- in the admin area; the server sends it to the channel through the news
-- bot and keeps a copy here: who wrote it, when, and the channel message id.
-- Server-only.

create table if not exists news_posts (
  id bigserial primary key,
  author_id uuid references profiles (id) on delete set null,
  author_label text not null default '',
  body text not null check (char_length(body) between 1 and 4000),
  tg_message_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists news_posts_created_idx on news_posts (created_at desc);
alter table news_posts enable row level security;
