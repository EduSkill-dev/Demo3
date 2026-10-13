-- 0048: attendance, and where a booking came from.
--
-- bookings.attended  null = not marked, true = came, false = did not come.
--   Only the club that runs the hike marks it (mark_attendance), from the
--   day of the hike on. Someone marked absent can no longer rate, comment
--   or like that hike or the club because of it — the policies below are
--   the existing ones with that one condition added.
-- bookings.source    which link brought the person to the hike's page
--   (facebook, instagram, whatsapp, viber, telegram, link), null = came
--   through Culmen itself. Written by the server with the booking.

alter table bookings add column if not exists attended boolean;
alter table bookings add column if not exists source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_source_known') then
    alter table bookings add constraint bookings_source_known
      check (source is null or source in ('facebook', 'instagram', 'whatsapp', 'viber', 'telegram', 'link')) not valid;
  end if;
end $$;

-- The club's roll call. p_attended null clears the mark.
create or replace function public.mark_attendance(p_booking uuid, p_attended boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_date date;
  v_status booking_status;
begin
  select t.date, b.status into v_date, v_status
  from bookings b
  join tours t on t.id = b.tour_id
  join clubs c on c.id = t.club_id
  where b.id = p_booking and c.owner_id = auth.uid();
  if not found then
    raise exception 'Հայտը չի գտնվել։';
  end if;
  if v_status <> 'confirmed' then
    raise exception 'Չեղարկված հայտի համար ներկայություն չի նշվում։';
  end if;
  if v_date > (now() at time zone 'Asia/Yerevan')::date then
    raise exception 'Ներկայությունը նշվում է արշավի օրվանից սկսած։';
  end if;
  update bookings set attended = p_attended where id = p_booking;
end;
$$;

revoke all on function public.mark_attendance(uuid, boolean) from public, anon;
grant execute on function public.mark_attendance(uuid, boolean) to authenticated;

drop policy if exists "Participants like the club they hiked with" on club_likes;
create policy "Participants like the club they hiked with" on club_likes
  for insert with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (bookings b
     JOIN tours t ON ((t.id = b.tour_id)))
  WHERE ((b.user_id = auth.uid()) AND (t.club_id = club_likes.club_id) AND (b.status = 'confirmed'::booking_status) AND (b.attended IS DISTINCT FROM false) AND (t.date <= CURRENT_DATE))))));

drop policy if exists "Only attendees can rate a club" on ratings;
create policy "Only attendees can rate a club" on ratings
  for insert with check (((user_id = auth.uid()) AND (((club_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (bookings b
     JOIN tours t ON ((t.id = b.tour_id)))
  WHERE ((b.user_id = auth.uid()) AND (t.club_id = ratings.club_id) AND (b.status = 'confirmed'::booking_status) AND (b.attended IS DISTINCT FROM false) AND (t.date <= CURRENT_DATE))))) OR ((tour_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (bookings b
     JOIN tours t ON ((t.id = b.tour_id)))
  WHERE ((b.user_id = auth.uid()) AND (b.tour_id = ratings.tour_id) AND (b.status = 'confirmed'::booking_status) AND (b.attended IS DISTINCT FROM false) AND (t.date <= CURRENT_DATE))))))));

drop policy if exists "Participants like the hike they attended" on tour_likes;
create policy "Participants like the hike they attended" on tour_likes
  for insert with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (bookings b
     JOIN tours t ON ((t.id = b.tour_id)))
  WHERE ((b.user_id = auth.uid()) AND (b.tour_id = tour_likes.tour_id) AND (b.status = 'confirmed'::booking_status) AND (b.attended IS DISTINCT FROM false) AND (t.date <= CURRENT_DATE))))));

CREATE OR REPLACE FUNCTION public.my_engagement()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'favorites', coalesce((select jsonb_agg(club_id) from favorite_clubs where user_id = auth.uid()), '[]'::jsonb),
    'clubLikes', coalesce((select jsonb_agg(club_id) from club_likes where user_id = auth.uid()), '[]'::jsonb),
    'tourLikes', coalesce((select jsonb_agg(tour_id) from tour_likes where user_id = auth.uid()), '[]'::jsonb),
    'attendedTours', coalesce((
      select jsonb_agg(distinct b.tour_id) from bookings b join tours t on t.id = b.tour_id
      where b.user_id = auth.uid() and (b.status = 'confirmed'::booking_status) AND (b.attended IS DISTINCT FROM false) and t.date <= current_date), '[]'::jsonb),
    'attendedClubs', coalesce((
      select jsonb_agg(distinct t.club_id) from bookings b join tours t on t.id = b.tour_id
      where b.user_id = auth.uid() and (b.status = 'confirmed'::booking_status) AND (b.attended IS DISTINCT FROM false) and t.date <= current_date), '[]'::jsonb)
  );
$function$;
