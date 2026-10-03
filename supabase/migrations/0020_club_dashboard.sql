-- 0020: what the rebuilt club dashboard needs.
--
--   * clubs.focus text[] of stable keys replaces the comma-separated
--     Armenian focus_areas (labels now come from the dictionaries)
--   * guides get a short bio; the name is one field
--   * notifications carry a kind and a sender, so the UI can render them in
--     the reader's language and say who sent them
--   * a tour that already has participants cannot be deleted, only
--     cancelled; cancelling or changing date/place notifies participants
--   * a cancelled application shows up unread again for the club

-- 1) Focus keys ---------------------------------------------------------------
alter table clubs add column if not exists focus text[] not null default '{}';

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'clubs' and column_name = 'focus_areas') then
    update clubs set focus = array(
      select distinct k from (
        select case trim(x)
          when 'Լեռներ ու սարեր' then 'mountaineering'
          when 'Լճեր և ափամերձարշավներ' then 'lakes'
          when 'Գիշերակացով արշավներ' then 'overnight'
          when 'Հեշտ և ընտանեկան արշավներ' then 'family'
        end as k
        from unnest(string_to_array(coalesce(focus_areas, ''), ',')) x
      ) m where k is not null
    )
    where focus = '{}';
    alter table clubs drop column focus_areas;
  end if;
end $$;

-- 2) Guides: one name field + bio -------------------------------------------
alter table club_guides add column if not exists bio text;
alter table club_guides alter column last_name drop not null;
alter table club_guides alter column last_name set default '';

-- 3) Notifications: kind + sender --------------------------------------------
alter table notifications add column if not exists kind text not null default 'new_tour';
alter table notifications add column if not exists sender_type text not null default 'club';
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('new_tour', 'tour_cancelled', 'tour_changed', 'platform'));
alter table notifications drop constraint if exists notifications_sender_check;
alter table notifications add constraint notifications_sender_check
  check (sender_type in ('club', 'platform'));
alter table notifications alter column club_id drop not null;

-- 4) Tours with participants: cancel, don't delete ----------------------------
create or replace function public.protect_booked_tour_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Only people are stopped; the service role / cascades (account deletion)
  -- still remove rows.
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and exists (select 1 from bookings where tour_id = old.id and status = 'confirmed') then
    raise exception 'Այս արշավին արդեն կան մասնակիցներ․ ջնջելու փոխարեն չեղարկեք այն։';
  end if;
  return old;
end;
$$;

drop trigger if exists on_tour_delete_protect_bookings on tours;
create trigger on_tour_delete_protect_bookings
  before delete on tours
  for each row execute function public.protect_booked_tour_delete();

-- 5) Tell participants when their tour is cancelled or moved ------------------
create or replace function public.notify_participants_on_tour_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_kind text;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    v_kind := 'tour_cancelled';
  elsif new.status <> 'cancelled' and (
    new.date is distinct from old.date
    or new.meeting_time is distinct from old.meeting_time
    or new.meeting_point is distinct from old.meeting_point
  ) then
    v_kind := 'tour_changed';
  else
    return new;
  end if;

  insert into notifications (user_id, club_id, tour_id, kind, sender_type, message)
  select b.user_id, new.club_id, new.id, v_kind, 'club', new.title
  from bookings b
  where b.tour_id = new.id and b.status = 'confirmed';

  return new;
end;
$$;

drop trigger if exists on_tour_change_notify_participants on tours;
create trigger on_tour_change_notify_participants
  after update of status, date, meeting_time, meeting_point on tours
  for each row execute function public.notify_participants_on_tour_change();

-- New-tour notices: only for tours that are actually published.
create or replace function public.notify_favorites_on_new_tour()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;
  insert into notifications (user_id, club_id, tour_id, kind, sender_type, message)
  select user_id, new.club_id, new.id, 'new_tour', 'club', new.title
  from favorite_clubs
  where club_id = new.club_id;
  return new;
end;
$$;

-- 6) A cancellation counts as news for the club -----------------------------
create or replace function public.flag_cancelled_booking_unread()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'confirmed' and new.status = 'cancelled' then
    new.read_at := null;
  end if;
  return new;
end;
$$;

-- Runs after the capacity trigger (names sort alphabetically).
drop trigger if exists on_booking_zz_flag_cancelled_unread on bookings;
create trigger on_booking_zz_flag_cancelled_unread
  before update on bookings
  for each row execute function public.flag_cancelled_booking_unread();
