-- 0028: the admin area.
--
--   * admins: who administers the platform. One super admin (created by
--     scripts/create-super-admin.cjs) creates the others and ticks what each
--     may manage: individuals / clubs / tours / pages. The super admin has a
--     second login address (alt_email); everyone starts with a one-time
--     password.
--   * profiles.status: active / frozen (signed in, read-only) / blocked
--     (cannot sign in). Only the server changes it.
--   * tours.admin_hidden: an admin took the listing off the site; the club
--     cannot undo it.
--   * site_texts: admin-edited replacements for the UI dictionaries.
--   * activity_log: who did what, when and from which IP.
--
-- Nothing here is writable from a browser: the admin pages and /api/admin use
-- the service role after checking the caller's permissions.

-- 1) Admins -------------------------------------------------------------------
create table if not exists admins (
  user_id uuid primary key references profiles (id) on delete cascade,
  is_super boolean not null default false,
  perms text[] not null default '{}',
  alt_email text unique,
  must_change_password boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;

-- 2) Account status -------------------------------------------------------------
alter table profiles add column if not exists status text not null default 'active';
alter table profiles drop constraint if exists profiles_status_check;
alter table profiles add constraint profiles_status_check check (status in ('active', 'frozen', 'blocked'));

-- Role and status are set by the server only (was: the role never changes).
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon')
     and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'Ակունտի դերը փոխելը հնարավոր չէ։';
  end if;
  return new;
end;
$$;

-- A frozen (or blocked) account can look but not touch. Bookings and payments
-- are written by the server, which checks the status itself.
create or replace function public.guard_inactive_account()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and exists (select 1 from profiles where id = auth.uid() and status <> 'active') then
    raise exception 'Ձեր հաշիվը սառեցված է․ գործողությունները ժամանակավորապես անհասանելի են։';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['tours', 'ratings', 'clubs', 'profiles', 'club_guides', 'favorite_clubs', 'payments']
  loop
    execute format('drop trigger if exists on_aa_guard_inactive_account on %I', v_table);
    execute format(
      'create trigger on_aa_guard_inactive_account before insert or update or delete on %I
         for each row execute function public.guard_inactive_account()', v_table);
  end loop;
end $$;

-- Blocking also ends the sessions that are already open.
create or replace function public.end_user_sessions(p_user uuid)
returns void
language plpgsql
security definer set search_path = public, auth
as $$
begin
  delete from auth.sessions where user_id = p_user;
exception when others then
  null; -- the ban still stops the next token refresh
end;
$$;
revoke all on function public.end_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.end_user_sessions(uuid) to service_role;

-- 3) Tours an admin took down ---------------------------------------------------
alter table tours add column if not exists admin_hidden boolean not null default false;

create or replace function public.guard_tour_admin_hidden()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.admin_hidden := false;
    elsif new.admin_hidden is distinct from old.admin_hidden then
      new.admin_hidden := old.admin_hidden;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_tour_guard_admin_hidden on tours;
create trigger on_tour_guard_admin_hidden
  before insert or update on tours
  for each row execute function public.guard_tour_admin_hidden();

drop policy if exists "Tours are readable by everyone" on tours;
create policy "Tours are readable by everyone" on tours
  for select using (
    (status = 'active' and not admin_hidden)
    or exists (select 1 from clubs c where c.id = tours.club_id and c.owner_id = auth.uid())
    or public.has_booked_tour(tours.id)
  );

-- No new sign-ups on a tour an admin took down, and only individuals book.
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
    if exists (select 1 from profiles where id = new.user_id and role <> 'individual') then
      raise exception 'Այս հաշվով արշավի գրանցվել հնարավոր չէ։';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_booking_guard_admin_rules on bookings;
create trigger on_booking_guard_admin_rules
  before insert or update on bookings
  for each row execute function public.guard_booking_admin_rules();

-- 4) Admin-edited texts -----------------------------------------------------------
create table if not exists site_texts (
  locale text not null,
  key text not null,
  value text not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (locale, key)
);
alter table site_texts enable row level security;
drop policy if exists "Site texts are readable by everyone" on site_texts;
create policy "Site texts are readable by everyone" on site_texts for select using (true);

-- 5) Activity log -------------------------------------------------------------------
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_role text,          -- individual / club / admin / super
  actor_label text,         -- name and email as they were at the time
  action text not null,     -- e.g. auth.login, tour.created, admin.account_blocked
  target_type text,
  target_id text,
  target_label text,
  ip text,
  meta jsonb not null default '{}'
);
create index if not exists activity_log_at_idx on activity_log (at desc);
create index if not exists activity_log_role_at_idx on activity_log (actor_role, at desc);
alter table activity_log enable row level security;

-- Writes one entry. Never fails the action it describes.
create or replace function public.log_activity(
  p_actor uuid,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_target_label text default null,
  p_meta jsonb default '{}',
  p_ip text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
  v_label text;
  v_ip text := p_ip;
begin
  if p_actor is not null then
    select
      case when p.role = 'admin' and coalesce(a.is_super, false) then 'super' else p.role::text end,
      trim(coalesce(
        (select c.name from clubs c where c.owner_id = p.id limit 1),
        nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
        ''
      ) || ' <' || p.email || '>')
    into v_role, v_label
    from profiles p left join admins a on a.user_id = p.id
    where p.id = p_actor;
  end if;

  -- A browser talking to the database directly: its address is in the headers.
  if v_ip is null and coalesce(auth.jwt() ->> 'role', '') = 'authenticated' then
    begin
      v_ip := nullif(trim(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)), '');
    exception when others then
      v_ip := null;
    end;
  end if;

  insert into activity_log (actor_id, actor_role, actor_label, action, target_type, target_id, target_label, ip, meta)
  values (p_actor, v_role, v_label, p_action, p_target_type, p_target_id, p_target_label, v_ip, coalesce(p_meta, '{}'));
exception when others then
  null;
end;
$$;
revoke all on function public.log_activity(uuid, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.log_activity(uuid, text, text, text, text, jsonb, text) to service_role;

-- What the database can see by itself. Sign-ins, account deletions and
-- everything admins do are logged by the server routes.
create or replace function public.log_row_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_by_person boolean := coalesce(auth.jwt() ->> 'role', '') = 'authenticated';
  v_owner uuid;
  v_title text;
  v_changed jsonb;
begin
  if tg_table_name = 'profiles' then
    if tg_op = 'INSERT' and new.role = 'individual' then
      perform log_activity(new.id, 'account.created', 'account', new.id::text, new.email);
    elsif tg_op = 'UPDATE' and v_by_person
      and (to_jsonb(new) - 'status' - 'role') is distinct from (to_jsonb(old) - 'status' - 'role') then
      perform log_activity(new.id, 'profile.updated', 'account', new.id::text, new.email);
    end if;

  elsif tg_table_name = 'clubs' then
    if tg_op = 'INSERT' then
      perform log_activity(new.owner_id, 'account.created', 'club', new.id::text, new.name);
    elsif v_by_person
      and (to_jsonb(new) - 'tariff' - 'package_ends_at') is distinct from (to_jsonb(old) - 'tariff' - 'package_ends_at') then
      perform log_activity(new.owner_id, 'club.updated', 'club', new.id::text, new.name);
    end if;

  elsif tg_table_name = 'tours' then
    if tg_op = 'DELETE' then
      -- Rows removed by a cascade (the club is gone) are covered by the
      -- account-deletion entry.
      select owner_id into v_owner from clubs where id = old.club_id;
      if found then
        perform log_activity(coalesce(auth.uid(), v_owner), 'tour.deleted', 'tour', old.id::text, old.title);
      end if;
    else
      select owner_id into v_owner from clubs where id = new.club_id;
      if tg_op = 'INSERT' then
        perform log_activity(coalesce(auth.uid(), v_owner), 'tour.created', 'tour', new.id::text, new.title);
      elsif new.status is distinct from old.status then
        perform log_activity(coalesce(auth.uid(), v_owner),
          case new.status when 'cancelled' then 'tour.cancelled' when 'hidden' then 'tour.hidden' else 'tour.shown' end,
          'tour', new.id::text, new.title);
      else
        select coalesce(jsonb_agg(n.key), '[]'::jsonb) into v_changed
        from jsonb_each(to_jsonb(new)) n
        where n.key <> 'admin_hidden' and n.value is distinct from (to_jsonb(old) -> n.key);
        if v_changed <> '[]'::jsonb then
          perform log_activity(coalesce(auth.uid(), v_owner), 'tour.updated', 'tour', new.id::text, new.title,
            jsonb_build_object('fields', v_changed));
        end if;
      end if;
    end if;

  elsif tg_table_name = 'bookings' then
    if new.user_id is not null and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      select title into v_title from tours where id = new.tour_id;
      perform log_activity(new.user_id,
        case when new.status = 'confirmed' then 'booking.created' else 'booking.cancelled' end,
        'tour', new.tour_id::text, v_title);
    end if;

  elsif tg_table_name = 'ratings' then
    select coalesce((select title from tours where id = new.tour_id), (select name from clubs where id = new.club_id)) into v_title;
    perform log_activity(new.user_id, 'review.created',
      case when new.tour_id is not null then 'tour' else 'club' end,
      coalesce(new.tour_id, new.club_id)::text, v_title, jsonb_build_object('score', new.score));

  elsif tg_table_name = 'payments' then
    if new.status = 'succeeded' then
      perform log_activity(new.user_id, 'payment.made', 'payment', new.id::text, null,
        jsonb_build_object('kind', new.kind, 'amount', new.amount, 'tariff', new.tariff));
    end if;
  end if;

  return null;
exception when others then
  return null;
end;
$$;

drop trigger if exists on_zz_log_activity on profiles;
create trigger on_zz_log_activity after insert or update on profiles
  for each row execute function public.log_row_activity();
drop trigger if exists on_zz_log_activity on clubs;
create trigger on_zz_log_activity after insert or update on clubs
  for each row execute function public.log_row_activity();
drop trigger if exists on_zz_log_activity on tours;
create trigger on_zz_log_activity after insert or update or delete on tours
  for each row execute function public.log_row_activity();
drop trigger if exists on_zz_log_activity on bookings;
create trigger on_zz_log_activity after insert or update on bookings
  for each row execute function public.log_row_activity();
drop trigger if exists on_zz_log_activity on ratings;
create trigger on_zz_log_activity after insert on ratings
  for each row execute function public.log_row_activity();
drop trigger if exists on_zz_log_activity on payments;
create trigger on_zz_log_activity after insert on payments
  for each row execute function public.log_row_activity();
