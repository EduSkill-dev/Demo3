-- 0066: the admins' bell. Everything that happens on the platform and may
-- need an admin's eye is written here by triggers: a new person or club, a
-- package payment, a newsletter subscriber, a suggestion and its author's
-- answer, a help-chat message, a custom request, a new listing, a review.
-- Rows are shared by all admins; each admin has a "seen up to" mark, so the
-- bell counts what came after it. `perm` says which admin permission may
-- see the row (null: every admin; super admins see all).

create table if not exists public.admin_events (
  id bigint generated always as identity primary key,
  kind text not null,
  perm text,
  title text not null,
  link text,
  created_at timestamptz not null default now()
);
create index if not exists admin_events_created on public.admin_events (created_at desc);
alter table public.admin_events enable row level security; -- read on the server only

alter table public.admins add column if not exists events_seen_at timestamptz not null default now();

create or replace function public.admin_event(p_kind text, p_perm text, p_title text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_events (kind, perm, title, link) values (p_kind, p_perm, left(p_title, 300), p_link);
$$;
revoke all on function public.admin_event(text, text, text, text) from public, anon, authenticated;

-- Enough of URL encoding for a ?q= value (names and e-mails).
create or replace function public.url_q(v text) returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(replace(coalesce(v, ''), '%', '%25'), '&', '%26'), '+', '%2B'), '#', '%23'), ' ', '%20');
$$;

-- Test accounts (e2e and screenshot runs use @example.com) never ring the bell.
create or replace function public.is_test_email(e text) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(lower(e) like '%@example.com', false);
$$;
create or replace function public.is_test_user(uid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.is_test_email(email) from public.profiles where id = uid), false);
$$;
revoke all on function public.is_test_user(uuid) from public, anon, authenticated;

-- Keep a year of history.
delete from public.admin_events where created_at < now() - interval '1 year';

-- New individual account (clubs are announced by the clubs row below).
create or replace function public.admin_event_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'individual' and not public.is_test_email(new.email) then
    perform public.admin_event('individual.new', 'individuals',
      'Նոր անհատ՝ ' || coalesce(nullif(trim(concat_ws(' ', new.first_name, new.last_name)), ''), new.email),
      '/admin/individuals?q=' || public.url_q(new.email));
  end if;
  return new;
end $$;
drop trigger if exists admin_event_profile on public.profiles;
create trigger admin_event_profile after insert on public.profiles for each row execute function public.admin_event_profile();

create or replace function public.admin_event_club() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_test_user(new.owner_id) then return new; end if;
  perform public.admin_event('club.new', 'clubs', 'Նոր ակումբ՝ ' || new.name, '/admin/clubs?q=' || public.url_q(new.name));
  return new;
end $$;
drop trigger if exists admin_event_club on public.clubs;
create trigger admin_event_club after insert on public.clubs for each row execute function public.admin_event_club();

-- A club's package payment (bookings' payments go to the clubs, not to us).
create or replace function public.admin_event_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare club_name text;
begin
  if new.kind = 'subscription' and new.status = 'succeeded'
     and not public.is_test_user(coalesce((select owner_id from public.clubs where id = new.club_id), new.user_id)) then
    select name into club_name from public.clubs where id = new.club_id;
    perform public.admin_event('payment.subscription', 'clubs',
      'Փաթեթի վճարում՝ ' || coalesce(club_name, '—') || ' · ' || upper(coalesce(new.tariff::text, '')) || ' · ' || new.amount::bigint || ' ' || coalesce(new.currency, '֏'),
      '/admin/clubs?q=' || public.url_q(club_name));
  end if;
  return new;
end $$;
drop trigger if exists admin_event_payment on public.payments;
create trigger admin_event_payment after insert on public.payments for each row execute function public.admin_event_payment();

-- Newsletter: once the address is confirmed.
create or replace function public.admin_event_newsletter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.confirmed_at is not null and (tg_op = 'INSERT' or old.confirmed_at is null) and not public.is_test_email(new.email) then
    perform public.admin_event('newsletter.new', null, 'Նոր բաժանորդ նորություններին՝ ' || new.email, '/admin');
  end if;
  return new;
end $$;
drop trigger if exists admin_event_newsletter on public.newsletter_subscribers;
create trigger admin_event_newsletter after insert or update of confirmed_at on public.newsletter_subscribers for each row execute function public.admin_event_newsletter();

-- Suggestions: once confirmed (a guest confirms the address first).
create or replace function public.admin_event_suggestion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.confirmed_at is not null and (tg_op = 'INSERT' or old.confirmed_at is null) and not public.is_test_email(new.email) then
    perform public.admin_event('suggestion.new', 'messages', 'Նոր առաջարկ՝ ' || left(new.message, 80), '/admin/messages');
  end if;
  return new;
end $$;
drop trigger if exists admin_event_suggestion on public.contact_messages;
create trigger admin_event_suggestion after insert or update of confirmed_at on public.contact_messages for each row execute function public.admin_event_suggestion();

create or replace function public.admin_event_suggestion_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.author = 'person' and not public.is_test_email((select email from public.contact_messages where id = new.message_id)) then
    perform public.admin_event('suggestion.reply', 'messages', 'Պատասխան առաջարկին՝ ' || left(new.body, 80), '/admin/messages');
  end if;
  return new;
end $$;
drop trigger if exists admin_event_suggestion_reply on public.contact_replies;
create trigger admin_event_suggestion_reply after insert on public.contact_replies for each row execute function public.admin_event_suggestion_reply();

create or replace function public.admin_event_support() returns trigger
language plpgsql security definer set search_path = '' as $$
declare who text;
begin
  if not new.from_admin and not public.is_test_user(new.user_id) then
    select coalesce(c.name, nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email) into who
      from public.profiles p left join public.clubs c on c.owner_id = p.id where p.id = new.user_id limit 1;
    perform public.admin_event('support.new', 'messages', 'Օգնության չաթ՝ ' || coalesce(who, '—') || '․ ' || left(new.body, 80), '/admin/messages');
  end if;
  return new;
end $$;
drop trigger if exists admin_event_support on public.support_messages;
create trigger admin_event_support after insert on public.support_messages for each row execute function public.admin_event_support();

create or replace function public.admin_event_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_test_user(new.user_id) then return new; end if;
  perform public.admin_event('request.new', 'individuals',
    'Նոր անհատական հայտ՝ ' || coalesce(new.author_name, '—') || ' · ' || new.people || ' հոգի', '/admin/requests');
  return new;
end $$;
drop trigger if exists admin_event_request on public.tour_requests;
create trigger admin_event_request after insert on public.tour_requests for each row execute function public.admin_event_request();

create or replace function public.admin_event_tour() returns trigger
language plpgsql security definer set search_path = '' as $$
declare club_name text;
begin
  if public.is_test_user((select owner_id from public.clubs where id = new.club_id)) then return new; end if;
  select name into club_name from public.clubs where id = new.club_id;
  perform public.admin_event('tour.new', 'tours', 'Նոր հայտարարություն՝ ' || new.title || ' (' || coalesce(club_name, '—') || ')', '/tours/' || new.id);
  return new;
end $$;
drop trigger if exists admin_event_tour on public.tours;
create trigger admin_event_tour after insert on public.tours for each row execute function public.admin_event_tour();

create or replace function public.admin_event_rating() returns trigger
language plpgsql security definer set search_path = '' as $$
declare club_name text; cid uuid;
begin
  if public.is_test_user(new.user_id) then return new; end if;
  cid := coalesce(new.club_id, (select club_id from public.tours where id = new.tour_id));
  select name into club_name from public.clubs where id = cid;
  perform public.admin_event('rating.new', 'clubs',
    'Նոր գնահատական՝ ' || coalesce(club_name, '—') || ' · ' || new.score || '★' || case when coalesce(new.comment, '') <> '' then ' · «' || left(new.comment, 60) || '»' else '' end,
    case when cid is null then null else '/clubs/' || cid end);
  return new;
end $$;
drop trigger if exists admin_event_rating on public.ratings;
create trigger admin_event_rating after insert on public.ratings for each row execute function public.admin_event_rating();

-- Old rows go once a day with the other housekeeping.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'admin-events-prune';
    perform cron.schedule('admin-events-prune', '17 3 * * *', $c$delete from public.admin_events where created_at < now() - interval '1 year'$c$);
  end if;
end $$;
