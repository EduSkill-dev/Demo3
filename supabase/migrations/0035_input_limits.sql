-- 0035: limits on what people can store, enforced in the database — the forms
-- have the same limits, but a modified browser can skip a form.
--
--   * text lengths and phone-number shape on everything a person types;
--   * sane ranges for numbers and list sizes;
--   * uploads: images only (JPG / PNG / WebP), at most 5 MB each;
--   * rate_hits + hit_rate_limit(): how often one address may call the open
--     endpoints (sign-in, sign-up check, forgot password, the footer forms).
--
-- The checks are NOT VALID: rows that exist are left alone, every new or
-- changed row has to pass.

-- A phone number: digits with the usual separators, 6-20 characters.
create or replace function public.phone_ok(p text)
returns boolean language sql immutable as $$
  select p is null or p ~ '^[+0-9 ()-]{6,20}$';
$$;

alter table profiles drop constraint if exists profiles_input_limits;
alter table profiles add constraint profiles_input_limits check (
  char_length(coalesce(first_name, '')) <= 60
  and char_length(coalesce(last_name, '')) <= 60
  and char_length(coalesce(gender, '')) <= 20
  and char_length(coalesce(photo_url, '')) <= 500
  and public.phone_ok(phone)
) not valid;

alter table clubs drop constraint if exists clubs_input_limits;
alter table clubs add constraint clubs_input_limits check (
  char_length(name) between 2 and 100
  and char_length(coalesce(description, '')) <= 5000
  and char_length(coalesce(photo_url, '')) <= 500
  and cardinality(focus) <= 20
  and public.phone_ok(phone)
) not valid;

alter table club_guides drop constraint if exists club_guides_input_limits;
alter table club_guides add constraint club_guides_input_limits check (
  char_length(first_name) between 1 and 200
  and char_length(coalesce(last_name, '')) <= 200
  and char_length(coalesce(role, '')) <= 200
  and char_length(coalesce(bio, '')) <= 4000
  and char_length(coalesce(photo_url, '')) <= 500
) not valid;

alter table tours drop constraint if exists tours_input_limits;
alter table tours add constraint tours_input_limits check (
  char_length(title) between 2 and 150
  and char_length(coalesce(description, '')) <= 5000
  and char_length(coalesce(notes, '')) <= 4000
  and char_length(coalesce(meeting_point, '')) <= 200
  and public.phone_ok(coordinator_phone)
  and max_participants between 0 and 10000
  and price between 0 and 100000000
  and cardinality(regions) <= 11
  and cardinality(terrains) <= 8
  and cardinality(photo_urls) <= 5
  and cardinality(sight_ids) <= 30
) not valid;

alter table ratings drop constraint if exists ratings_input_limits;
alter table ratings add constraint ratings_input_limits check (
  char_length(coalesce(comment, '')) <= 4000
) not valid;

-- Uploads -------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'club-assets';

-- Rate limits ---------------------------------------------------------------------
create table if not exists rate_hits (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_hits_key_at_idx on rate_hits (key, at);
alter table rate_hits enable row level security;

-- Counts this call. True = over the limit (the call is not counted then).
create or replace function public.hit_rate_limit(p_key text, p_max int, p_minutes int)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(mins => p_minutes);
  v_count int;
begin
  delete from rate_hits where key = p_key and at < v_since;
  select count(*) into v_count from rate_hits where key = p_key and at >= v_since;
  if v_count >= p_max then
    return true;
  end if;
  insert into rate_hits (key) values (p_key);
  return false;
end;
$$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
