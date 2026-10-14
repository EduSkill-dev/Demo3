-- 0054: the clubs' news reach the clubs on the site too.
--
-- A post to the news channel (written in the admin area or straight in
-- Telegram — the channel's bot reports those) is kept once in news_posts,
-- and every club gets a "platform" notification on its bell, unless it
-- switched platform news off.

create unique index if not exists news_posts_tg_message_key on news_posts (tg_message_id) where tg_message_id is not null;

create or replace function public.notify_clubs_of_news()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into notifications (user_id, kind, sender_type, message)
  select c.owner_id, 'platform', 'platform', new.body
  from clubs c
  join profiles p on p.id = c.owner_id
  where p.status <> 'blocked' and p.platform_news is distinct from false;
  return new;
end;
$$;

drop trigger if exists on_news_post_notify_clubs on news_posts;
create trigger on_news_post_notify_clubs
  after insert on news_posts
  for each row when (new.tg_message_id is not null)
  execute function public.notify_clubs_of_news();
