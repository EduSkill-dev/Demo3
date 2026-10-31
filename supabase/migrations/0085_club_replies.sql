-- 0085: a club answers its comments (Advanced, feature dashboard_comments_tab).
-- The answer lives in its own table so a comment's author can never touch it;
-- it is written only through club_reply_rating(), which web and mobile share.
create table if not exists public.rating_replies (
  rating_id uuid primary key references public.ratings(id) on delete cascade,
  reply text not null check (char_length(reply) between 1 and 1000),
  replied_at timestamptz not null default now()
);
alter table public.rating_replies enable row level security;
drop policy if exists "Replies are readable by everyone" on public.rating_replies;
create policy "Replies are readable by everyone" on public.rating_replies for select using (true);

create or replace view public.public_reviews as
  select r.id, r.score, r.comment, r.created_at, r.tour_id,
    coalesce(r.club_id, t.club_id) as club_id,
    t.title as tour_title, t.date as tour_date,
    (r.user_id is null) as author_deleted,
    p.first_name as author_first_name,
    left(coalesce(p.last_name, ''), 1) as author_last_initial,
    p.photo_url as author_photo_url,
    rr.reply as club_reply,
    rr.replied_at as club_replied_at
  from public.ratings r
  left join public.tours t on t.id = r.tour_id
  left join public.profiles p on p.id = r.user_id
  left join public.rating_replies rr on rr.rating_id = r.id;

create or replace function public.club_reply_rating(p_rating uuid, p_reply text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid;
  v_reply text := btrim(coalesce(p_reply, ''));
begin
  select coalesce(r.club_id, t.club_id) into v_club
    from public.ratings r left join public.tours t on t.id = r.tour_id where r.id = p_rating;
  if v_club is null or not exists (select 1 from public.clubs c where c.id = v_club and c.owner_id = auth.uid()) then
    raise exception 'Մեկնաբանությունը չի գտնվել։';
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.status <> 'active') then
    raise exception 'Ձեր հաշիվը սառեցված է․ գործողությունները ժամանակավորապես անհասանելի են։';
  end if;
  if not public.club_has_feature(v_club, 'dashboard_comments_tab') then
    raise exception 'Մեկնաբանությունների բաժինը ներառված է Advanced փաթեթում։';
  end if;
  if char_length(v_reply) > 1000 then
    raise exception 'Պատասխանը չափազանց երկար է։';
  end if;
  if v_reply = '' then
    delete from public.rating_replies where rating_id = p_rating;
  else
    insert into public.rating_replies (rating_id, reply) values (p_rating, v_reply)
      on conflict (rating_id) do update set reply = excluded.reply, replied_at = now();
  end if;
end $$;
revoke all on function public.club_reply_rating(uuid, text) from public, anon;
grant execute on function public.club_reply_rating(uuid, text) to authenticated;
