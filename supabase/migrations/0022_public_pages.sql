-- 0022: read helpers for the public pages.
--
--   * public_reviews: reviews with the reviewer's first name, last-name
--     initial and photo — and nothing else from their profile
--   * club_rating_summary: one average per club over the club's own
--     ratings and the ratings of its hikes
--   * tours_seats_taken: confirmed seats for many tours in one call

create or replace view public.public_reviews as
  select
    r.id,
    r.score,
    r.comment,
    r.created_at,
    r.tour_id,
    coalesce(r.club_id, t.club_id) as club_id,
    t.title as tour_title,
    t.date as tour_date,
    (r.user_id is null) as author_deleted,
    p.first_name as author_first_name,
    left(coalesce(p.last_name, ''), 1) as author_last_initial,
    p.photo_url as author_photo_url
  from ratings r
  left join tours t on t.id = r.tour_id
  left join profiles p on p.id = r.user_id;

grant select on public.public_reviews to anon, authenticated;

create or replace view public.club_rating_summary as
  select club_id, round(avg(score)::numeric, 1) as average, count(*)::int as count
  from public.public_reviews
  group by club_id;

grant select on public.club_rating_summary to anon, authenticated;

create or replace function public.tours_seats_taken(p_tours uuid[])
returns table (tour_id uuid, taken int)
language sql stable security definer set search_path = public
as $$
  select b.tour_id, count(*)::int
  from bookings b
  where b.tour_id = any(p_tours) and b.status = 'confirmed'
  group by b.tour_id;
$$;
grant execute on function public.tours_seats_taken(uuid[]) to anon, authenticated;
