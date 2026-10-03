-- 0021: what the rebuilt personal account needs.
--
--   * profile photos under club-assets/avatars/<user id>/…
--   * deleting an account keeps the club's history readable: upcoming
--     bookings are cancelled first, and bookings / ratings / payments keep
--     their rows with user_id set to null ("deleted user")
--   * account deletion may cancel inside the 48-hour window (server only)

-- 1) Avatars ------------------------------------------------------------------
drop policy if exists "Users upload their avatar" on storage.objects;
create policy "Users upload their avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users replace their avatar" on storage.objects;
create policy "Users replace their avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users delete their avatar" on storage.objects;
create policy "Users delete their avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-assets'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- 2) History survives account deletion ---------------------------------------
alter table bookings alter column user_id drop not null;
alter table bookings drop constraint if exists bookings_user_id_fkey;
alter table bookings add constraint bookings_user_id_fkey
  foreign key (user_id) references profiles (id) on delete set null;

alter table ratings alter column user_id drop not null;
alter table ratings drop constraint if exists ratings_user_id_fkey;
alter table ratings add constraint ratings_user_id_fkey
  foreign key (user_id) references profiles (id) on delete set null;

alter table payments alter column user_id drop not null;
alter table payments drop constraint if exists payments_user_id_fkey;
alter table payments add constraint payments_user_id_fkey
  foreign key (user_id) references profiles (id) on delete set null;

-- 3) Cancelling for a deleted account -----------------------------------------
-- The capacity trigger (0018) with one change: the 48-hour rule can be
-- lifted for the current transaction by highland.force_cancel = 'on'.
create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tour record;
  v_role user_role;
  v_confirmed timestamptz;
  v_tariff tariff;
  v_limit int;
  v_taken int;
  v_existing uuid;
begin
  perform pg_advisory_xact_lock(hashtext(new.tour_id::text));

  select id, club_id, date, meeting_time, max_participants, status into v_tour
  from tours where id = new.tour_id;
  if not found then
    raise exception 'Արշավը չի գտնվել։';
  end if;

  if tg_op = 'INSERT' then
    select coalesce(max(seq), 0) + 1 into new.seq from bookings where tour_id = new.tour_id;
  end if;

  if tg_op = 'UPDATE' and old.status = 'confirmed' and new.status = 'cancelled' then
    if tour_starts_at(v_tour.date, v_tour.meeting_time) - now() < interval '48 hours'
       and coalesce(current_setting('highland.force_cancel', true), '') <> 'on' then
      raise exception 'Չեղարկել հնարավոր է միայն արշավից առնվազն 48 ժամ առաջ։';
    end if;
    new.cancelled_at := now();
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

  if v_tour.date < current_date then
    raise exception 'Այս արշավն արդեն տեղի է ունեցել։';
  end if;
  if v_tour.status <> 'active' then
    raise exception 'Այս արշավին գրանցումը փակ է։';
  end if;

  select role into v_role from profiles where id = new.user_id;
  if v_role = 'club' then
    raise exception 'Ակումբները չեն կարող գրանցվել արշավներին։';
  end if;

  select email_confirmed_at into v_confirmed from auth.users where id = new.user_id;
  if v_confirmed is null then
    raise exception 'Գրանցվելու համար նախ հաստատեք Ձեր էլ. հասցեն։';
  end if;

  select id into v_existing
  from bookings
  where tour_id = new.tour_id and user_id = new.user_id
    and status = 'confirmed' and id <> new.id;
  if v_existing is not null then
    raise exception 'Արդեն գրանցված եք այս արշավին։';
  end if;

  v_tariff := club_active_tariff(v_tour.club_id);
  if v_tariff is null then
    raise exception 'Այս արշավին գրանցումը ժամանակավորապես փակ է։';
  end if;
  v_limit := least(v_tour.max_participants, tariff_max_participants(v_tariff));

  select count(*) into v_taken
  from bookings
  where tour_id = new.tour_id and status = 'confirmed' and id <> new.id;

  if v_taken >= v_limit then
    raise exception 'Տեղերը սպառված են (%/%)։', v_taken, v_limit;
  end if;

  return new;
end;
$$;

-- Server-only: cancel every upcoming booking of a user who is deleting
-- their account, and say which ones so the clubs can be told.
create or replace function public.cancel_bookings_for_deleted_account(p_user uuid)
returns table (booking_id uuid, tour_id uuid)
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('highland.force_cancel', 'on', true);
  return query
    update bookings b set status = 'cancelled'
    from tours t
    where b.tour_id = t.id and b.user_id = p_user
      and b.status = 'confirmed' and t.date >= current_date
    returning b.id, b.tour_id;
end;
$$;
revoke all on function public.cancel_bookings_for_deleted_account(uuid) from public, anon, authenticated;
grant execute on function public.cancel_bookings_for_deleted_account(uuid) to service_role;
