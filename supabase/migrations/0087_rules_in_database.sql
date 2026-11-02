-- 0087: launch plan phase 3, the rules the tour form checks now also hold for
-- whoever writes to the database with a user's session (the future mobile app
-- included). The server's own jobs (auth.uid() is null) are not bound by them.
--   * One Advanced payment buys 31 days (Gor, 2026-11-02).
--   * A listing goes out only with a future date, a place and at least one
--     photo. Drafts may be incomplete. (The meeting point and time already have
--     their own rule, require_meeting_details.)
--   * A club whose posting is switched off cannot publish a hidden listing again.
--   * Nobody signs up for a hike of a blocked club.
--   * Bug fix: a confirmed guest has no account, so telling participants about a
--     change failed and the club could not cancel or move that hike.

update public.site_settings
  set value = jsonb_set(value, '{advanced_days}', '31')
  where key = 'business' and (value ->> 'advanced_days')::int = 30;

create or replace function public.enforce_tour_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_publishing boolean;
begin
  if auth.uid() is null then return new; end if;
  if new.status <> 'active' then return new; end if;
  v_publishing := tg_op = 'INSERT' or old.status is distinct from 'active';

  if (tg_op = 'INSERT' or new.date is distinct from old.date)
     and new.date < (now() at time zone 'Asia/Yerevan')::date then
    raise exception 'tour_past_date: Արշավի ամսաթիվն արդեն անցել է։';
  end if;
  if v_publishing and cardinality(new.sight_ids) = 0 then
    raise exception 'tour_needs_place: Նշեք արշավի վայրը։';
  end if;
  if (v_publishing or new.photo_urls is distinct from old.photo_urls) and cardinality(new.photo_urls) = 0 then
    raise exception 'tour_needs_photo: Ավելացրեք առնվազն մեկ լուսանկար։';
  end if;
  return new;
end $$;

drop trigger if exists on_tour_enforce_rules on public.tours;
create trigger on_tour_enforce_rules before insert or update on public.tours
  for each row execute function public.enforce_tour_rules();

create or replace function public.guard_club_posting()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (new.status <> 'active' or old.status = 'active') then
    return new;
  end if;
  if exists (select 1 from clubs where id = new.club_id and posting_blocked) then
    raise exception 'Նոր հայտարարություն ավելացնելու հնարավորությունն անջատված է ադմինիստրատորի կողմից։';
  end if;
  return new;
end;
$$;

drop trigger if exists on_tour_guard_club_posting on public.tours;
create trigger on_tour_guard_club_posting
  before insert or update of status on public.tours
  for each row execute function public.guard_club_posting();

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
  where b.tour_id = new.id and b.status = 'confirmed' and b.user_id is not null;

  return new;
end;
$$;

create or replace function public.guard_booking_admin_rules()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    if exists (select 1 from tours where id = new.tour_id and admin_hidden) then
      raise exception 'Այս արշավին գրանցումը փակ է։';
    end if;
    if exists (select 1 from tours t join clubs c on c.id = t.club_id where t.id = new.tour_id and c.owner_blocked) then
      raise exception 'Այս արշավին գրանցումը փակ է։';
    end if;
    if exists (select 1 from tours t join clubs c on c.id = t.club_id where t.id = new.tour_id and c.applications_blocked) then
      raise exception 'Այս ակումբի արշավներին գրանցումը ժամանակավորապես փակ է։';
    end if;
    if exists (select 1 from profiles where id = new.user_id and role <> 'individual') then
      raise exception 'Այս հաշվով արշավի գրանցվել հնարավոր չէ։';
    end if;
    if exists (select 1 from profiles where id = new.user_id and booking_blocked) then
      raise exception 'Արշավներին գրանցվելու հնարավորությունն անջատված է ադմինիստրատորի կողմից։';
    end if;
  end if;
  return new;
end;
$$;
