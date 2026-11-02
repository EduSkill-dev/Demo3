-- 0088: changing a hike people have booked (Gor, 2026-11-02). Holds for whoever
-- writes with a user's session; the server's own jobs and admins are not bound.
--   * After the cancellation deadline the listing can no longer be edited.
--   * Before it, the date, meeting time and place and the route may change at
--     most "tour_change_limit" times (site_settings "business"), each with a
--     reason. "other" needs the reason in words.
--   * The price, the cancellation window and the name stay; the name may follow
--     a new route. The size cannot drop below the people already booked.
--   * Everyone who booked before a change may cancel until the hike starts and
--     gets the whole amount back; the club bears the transfer fees.
--   * Each change and cancellation is kept in tour_changes: admins see what
--     changed, and the server emails participants, guests and the admins.

insert into public.site_settings (key, value) values ('business', '{}'::jsonb) on conflict (key) do nothing;
update public.site_settings set value = value || '{"tour_change_limit": 2}'::jsonb
  where key = 'business' and not value ? 'tour_change_limit';

alter table public.tours
  add column if not exists changes_used integer not null default 0,
  add column if not exists last_change_at timestamptz,
  add column if not exists change_reason text, -- passes through the update, never stored
  add column if not exists change_note text;   -- the same

alter table public.bookings add column if not exists refund_in_full boolean not null default false;

create table if not exists public.tour_changes (
  id bigint generated always as identity primary key,
  tour_id uuid references public.tours(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  tour_title text not null,
  kind text not null check (kind in ('change', 'cancel')),
  reason text check (reason in ('route', 'date', 'departure', 'weather', 'safety', 'transport', 'guide', 'other')),
  note text check (char_length(note) <= 300),
  before jsonb,
  after jsonb,
  participants integer not null default 0,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists tour_changes_at on public.tour_changes (changed_at desc);
create index if not exists tour_changes_pending on public.tour_changes (changed_at) where notified_at is null;
alter table public.tour_changes enable row level security;
drop policy if exists "A club reads the changes of its own hikes" on public.tour_changes;
create policy "A club reads the changes of its own hikes" on public.tour_changes for select
  using (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()));

-- What people care about in a hike, as it stands in this row.
create or replace function public.tour_change_facts(p_date date, p_end date, p_overnight boolean, p_time time, p_point text, p_sights uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'date', p_date, 'end_date', p_end, 'overnight', p_overnight, 'meeting_time', p_time, 'meeting_point', p_point,
    'places', coalesce((select jsonb_agg(s.name_hy order by s.name_hy) from public.sights s where s.id = any(p_sights)), '[]'::jsonb));
$$;
revoke all on function public.tour_change_facts(date, date, boolean, time, text, uuid[]) from public, anon, authenticated;

create or replace function public.guard_tour_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := new.change_reason;
  v_note text := nullif(trim(coalesce(new.change_note, '')), '');
  v_booked integer;
  v_owner uuid;
  v_club text;
  v_route boolean;
  v_limit integer;
begin
  new.change_reason := null;
  new.change_note := null;
  if tg_op = 'INSERT' then
    new.changes_used := 0;
    new.last_change_at := null;
    return new;
  end if;
  new.changes_used := old.changes_used;
  new.last_change_at := old.last_change_at;

  if auth.uid() is null or old.status = 'cancelled' then return new; end if;
  select count(*) into v_booked from public.bookings b where b.tour_id = old.id and b.status = 'confirmed';
  if v_booked = 0 then return new; end if;
  select c.owner_id, c.name into v_owner, v_club from public.clubs c where c.id = old.club_id;

  if new.status = 'cancelled' then
    insert into public.tour_changes (tour_id, club_id, tour_title, kind, participants, changed_by)
      values (old.id, old.club_id, old.title, 'cancel', v_booked, auth.uid());
    if not public.is_test_user(v_owner) then
      perform public.admin_event('tour.changed', 'tours', 'Չեղարկված արշավ՝ ' || old.title || ' (' || coalesce(v_club, '—') || ')', '/admin/tour-changes');
    end if;
    return new;
  end if;

  if row(new.title, new.description, new.notes, new.meeting_point, new.meeting_time, new.date, new.end_date, new.overnight, new.price, new.cancel_hours, new.max_participants, new.coordinator_phone, new.bring_items, new.photo_urls, new.sight_ids)
     is not distinct from
     row(old.title, old.description, old.notes, old.meeting_point, old.meeting_time, old.date, old.end_date, old.overnight, old.price, old.cancel_hours, old.max_participants, old.coordinator_phone, old.bring_items, old.photo_urls, old.sight_ids) then
    return new;
  end if;

  if public.tour_starts_at(old.date, old.meeting_time) - now() < make_interval(hours => old.cancel_hours) then
    raise exception 'tour_change_deadline: Չեղարկման ժամկետից հետո հայտարարությունը փոխել չի կարելի։';
  end if;
  if new.price is distinct from old.price then
    raise exception 'tour_locked_price: Ամրագրումներով արշավի գինը փոխել չի կարելի։';
  end if;
  if new.cancel_hours is distinct from old.cancel_hours then
    raise exception 'tour_locked_cancel_hours: Ամրագրումներով արշավի չեղարկման ժամկետը փոխել չի կարելի։';
  end if;
  if new.max_participants < v_booked then
    raise exception 'tour_capacity_below_booked: Մասնակիցների թիվը չի կարող պակաս լինել ամրագրածներից (%)։', v_booked;
  end if;
  v_route := new.sight_ids is distinct from old.sight_ids;
  if new.title is distinct from old.title and not v_route then
    raise exception 'tour_locked_title: Ամրագրումներով արշավի անունը կարելի է փոխել միայն երթուղու հետ։';
  end if;

  if not v_route and new.date is not distinct from old.date and new.end_date is not distinct from old.end_date
     and new.overnight is not distinct from old.overnight and new.meeting_time is not distinct from old.meeting_time
     and new.meeting_point is not distinct from old.meeting_point then
    return new;
  end if;

  v_limit := public.business_setting('tour_change_limit');
  if old.changes_used >= v_limit then
    raise exception 'tour_change_limit: Այս արշավը կարելի է փոխել առավելագույնը % անգամ։ Կարող եք չեղարկել այն։', v_limit;
  end if;
  if v_reason is null or v_reason not in ('route', 'date', 'departure', 'weather', 'safety', 'transport', 'guide', 'other')
     or (v_reason = 'other' and char_length(coalesce(v_note, '')) < 3) then
    raise exception 'tour_change_reason: Նշեք փոփոխության պատճառը։';
  end if;

  insert into public.tour_changes (tour_id, club_id, tour_title, kind, reason, note, before, after, participants, changed_by)
    values (old.id, old.club_id, new.title, 'change', v_reason, left(v_note, 300),
      public.tour_change_facts(old.date, old.end_date, old.overnight, old.meeting_time, old.meeting_point, old.sight_ids),
      public.tour_change_facts(new.date, new.end_date, new.overnight, new.meeting_time, new.meeting_point, new.sight_ids),
      v_booked, auth.uid());
  new.changes_used := old.changes_used + 1;
  new.last_change_at := now();
  if not public.is_test_user(v_owner) then
    perform public.admin_event('tour.changed', 'tours', 'Փոփոխված արշավ՝ ' || new.title || ' (' || coalesce(v_club, '—') || ')', '/admin/tour-changes');
  end if;
  return new;
end $$;

drop trigger if exists on_tour_guard_changes on public.tours;
create trigger on_tour_guard_changes before insert or update on public.tours
  for each row execute function public.guard_tour_changes();

-- The bell also rings when the route or the last day changes.
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
    or new.end_date is distinct from old.end_date
    or new.meeting_time is distinct from old.meeting_time
    or new.meeting_point is distinct from old.meeting_point
    or new.sight_ids is distinct from old.sight_ids
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

drop trigger if exists on_tour_change_notify_participants on public.tours;
create trigger on_tour_change_notify_participants
  after update of status, date, end_date, meeting_time, meeting_point, sight_ids on public.tours
  for each row execute function public.notify_participants_on_tour_change();

-- 0084's booking trigger; someone who booked before a change may cancel until
-- the hike starts, and that cancellation is refunded in full.
CREATE OR REPLACE FUNCTION public.enforce_booking_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tour record;
  v_role user_role;
  v_confirmed timestamptz;
  v_limit int;
  v_taken int;
  v_existing uuid;
  v_changed boolean;
begin
  perform pg_advisory_xact_lock(hashtext(new.tour_id::text));

  select id, club_id, date, meeting_time, max_participants, status, cancel_hours, last_change_at into v_tour
  from tours where id = new.tour_id;
  if not found then
    raise exception 'Արշավը չի գտնվել։';
  end if;

  if tg_op = 'INSERT' then
    select coalesce(max(seq), 0) + 1 into new.seq from bookings where tour_id = new.tour_id;
  end if;

  if tg_op = 'UPDATE' and old.status = 'confirmed' and new.status = 'cancelled' then
    v_changed := v_tour.last_change_at is not null and v_tour.last_change_at > old.created_at;
    if tour_starts_at(v_tour.date, v_tour.meeting_time) - now() < make_interval(hours => case when v_changed then 0 else coalesce(v_tour.cancel_hours, 48) end)
       and (new.user_id is not null or new.guest_id is not null)
       and coalesce(current_setting('highland.force_cancel', true), '') <> 'on' then
      raise exception 'Չեղարկել հնարավոր է միայն արշավից առնվազն % ժամ առաջ։', coalesce(v_tour.cancel_hours, 48);
    end if;
    new.refund_in_full := v_changed;
    new.cancelled_at := coalesce(new.cancelled_at, now());
    return new;
  end if;

  if new.status is distinct from 'confirmed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' then
    return new;
  end if;

  new.cancelled_at := null;
  new.read_at := null;
  new.refund_in_full := false;

  if v_tour.date < current_date then
    raise exception 'Այս արշավն արդեն տեղի է ունեցել։';
  end if;
  if v_tour.status <> 'active' then
    raise exception 'Այս արշավին գրանցումը փակ է։';
  end if;

  if new.user_id is not null then
    select role into v_role from profiles where id = new.user_id;
    if v_role = 'club' then
      raise exception 'Ակումբները չեն կարող գրանցվել արշավներին։';
    end if;
    select email_confirmed_at into v_confirmed from auth.users where id = new.user_id;
    if v_confirmed is null then
      raise exception 'Գրանցվելու համար նախ հաստատեք Ձեր էլ. հասցեն։';
    end if;
    select id into v_existing from bookings
    where tour_id = new.tour_id and user_id = new.user_id and status = 'confirmed' and id <> new.id;
  elsif new.guest_id is not null then
    select id into v_existing from bookings
    where tour_id = new.tour_id and guest_id = new.guest_id and status = 'confirmed' and id <> new.id;
  else
    raise exception 'Գրանցումը պետք է լինի հաշվով կամ հյուրի տվյալներով։';
  end if;
  if v_existing is not null then
    raise exception 'Արդեն գրանցված եք այս արշավին։';
  end if;

  -- How many people a hike takes is the club's own number, whatever its plan.
  v_limit := v_tour.max_participants;

  select count(*) into v_taken
  from bookings
  where tour_id = new.tour_id and status = 'confirmed' and id <> new.id;

  if v_taken >= v_limit then
    raise exception 'Տեղերը սպառված են (%/%)։', v_taken, v_limit;
  end if;

  return new;
end;
$function$;
