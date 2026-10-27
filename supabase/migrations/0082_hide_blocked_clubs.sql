-- 0082: a blocked club disappears from the platform (Gor, 2026-10-27).
-- Nothing is deleted: the club, its hikes, guides and bookings stay as they
-- are and come back the moment an admin re-activates the account. While
-- blocked, nobody but the club itself (who cannot sign in anyway) and the
-- server reads them: no club page, no card, no hikes in the lists, the
-- calendar or on places. People already booked on its hikes still see their
-- own bookings (the admins settle those one by one).
-- A frozen club stays visible; it only cannot act (unchanged).

alter table public.clubs add column if not exists owner_blocked boolean not null default false;
update public.clubs c set owner_blocked = (p.status = 'blocked') from public.profiles p where p.id = c.owner_id;

-- Kept in step with the owner's account status.
create or replace function public.sync_club_owner_blocked() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    update public.clubs set owner_blocked = (new.status = 'blocked') where owner_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists sync_club_owner_blocked on public.profiles;
create trigger sync_club_owner_blocked after update of status on public.profiles
  for each row execute function public.sync_club_owner_blocked();

-- Only the server sets it.
create or replace function public.guard_club_owner_blocked() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    new.owner_blocked := case when tg_op = 'INSERT' then false else old.owner_blocked end;
  end if;
  return new;
end $$;
drop trigger if exists on_club_guard_owner_blocked on public.clubs;
create trigger on_club_guard_owner_blocked before insert or update on public.clubs
  for each row execute function public.guard_club_owner_blocked();

-- "Is this club shown?" — read past RLS, so policies on other tables can ask.
create or replace function public.club_shown(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select not owner_blocked from public.clubs where id = p_club), false);
$$;
grant execute on function public.club_shown(uuid) to anon, authenticated;

drop policy if exists "Clubs are readable by everyone" on public.clubs;
create policy "Clubs are readable by everyone" on public.clubs for select
  using (not owner_blocked or owner_id = auth.uid());

drop policy if exists "Tours are readable by everyone" on public.tours;
create policy "Tours are readable by everyone" on public.tours for select
  using (
    (status = 'active' and not admin_hidden and public.club_shown(club_id))
    or exists (select 1 from public.clubs c where c.id = tours.club_id and c.owner_id = auth.uid())
    or public.has_booked_tour(id)
  );

drop policy if exists "Guides are readable by everyone" on public.club_guides;
create policy "Guides are readable by everyone" on public.club_guides for select
  using (public.club_shown(club_id));

-- The public counts and the places' fallback photos leave a blocked club out.
create or replace function public.get_about_stats()
returns table (clubs_count bigint, users_count bigint, tours_count bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.clubs where not owner_blocked),
    (select count(*) from public.profiles),
    (select count(*) from public.tours t where public.club_shown(t.club_id));
$$;

create or replace function public.sight_stats()
returns table (sight_id uuid, likes int, hikes int, upcoming int, tour_photo text)
language sql stable security definer set search_path = public as $$
  select s.id,
    (select count(*) from sight_likes l where l.sight_id = s.id)::int,
    (select count(*) from tours t where s.id = any (t.sight_ids) and t.status = 'active' and not t.admin_hidden and public.club_shown(t.club_id))::int,
    (select count(*) from tours t where s.id = any (t.sight_ids) and t.status = 'active' and not t.admin_hidden and public.club_shown(t.club_id)
       and coalesce(t.end_date, t.date) >= current_date)::int,
    (select t.photo_urls[1] from tours t
      where s.id = any (t.sight_ids) and t.status = 'active' and not t.admin_hidden and public.club_shown(t.club_id) and cardinality(t.photo_urls) > 0
      order by t.date desc limit 1)
  from sights s
  where s.active;
$$;
