-- 0072: a platform post chooses whom it is for (Gor, 2026-10-19):
--   to_individuals / to_clubs   who sees it on the site (the bell), whatever
--                               their switches; clubs also get it in the
--                               Telegram channel
--   important                   also emailed to everyone in the audience;
--                               otherwise only to those with "notifications
--                               from the platform" on
-- A post written straight in the Telegram channel stays a clubs' post.

alter table public.news_posts add column if not exists to_individuals boolean not null default false;
alter table public.news_posts add column if not exists to_clubs boolean not null default true;
alter table public.news_posts add column if not exists important boolean not null default false;
alter table public.news_posts add column if not exists emailed integer;

-- Every account in the audience gets the post on its bell, at once (the
-- channel is no longer the trigger: a post for individuals has none).
create or replace function public.notify_clubs_of_news()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into notifications (user_id, kind, sender_type, message)
  select p.id, 'platform', 'platform', case when new.important then '❗ ' else '' end || new.body
  from profiles p
  where p.status <> 'blocked'
    and ((new.to_clubs and p.role = 'club') or (new.to_individuals and p.role = 'individual'))
    -- A post by a test account (e2e) reaches test accounts only.
    and (not public.is_test_user(new.author_id) or public.is_test_email(p.email));
  return new;
end;
$$;

drop trigger if exists on_news_post_notify_clubs on news_posts;
create trigger on_news_post_notify_clubs
  after insert on news_posts
  for each row
  execute function public.notify_clubs_of_news();
