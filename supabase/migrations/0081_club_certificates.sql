-- 0081: a club's certificate (Gor, 2026-10-20). The club uploads a picture of
-- its document; an admin checks it and approves or rejects it; an approved
-- one puts a blue "certified" badge by the club's name everywhere and opens
-- from the club's page.
--   certificate_status  null (none) · pending · approved · rejected
-- A club may change only the picture: a new one (or none) starts the check
-- again; the status and the review fields are the server's.

alter table public.clubs
  add column if not exists certificate_url text,
  add column if not exists certificate_status text check (certificate_status in ('pending', 'approved', 'rejected')),
  add column if not exists certificate_note text,          -- why it was rejected
  add column if not exists certificate_submitted_at timestamptz,
  add column if not exists certificate_reviewed_at timestamptz;

create or replace function public.guard_club_certificate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.certificate_url := null;
      new.certificate_status := null;
      new.certificate_note := null;
      new.certificate_submitted_at := null;
      new.certificate_reviewed_at := null;
    elsif new.certificate_url is distinct from old.certificate_url then
      new.certificate_status := case when new.certificate_url is null then null else 'pending' end;
      new.certificate_note := null;
      new.certificate_submitted_at := case when new.certificate_url is null then null else now() end;
      new.certificate_reviewed_at := null;
    else
      new.certificate_status := old.certificate_status;
      new.certificate_note := old.certificate_note;
      new.certificate_submitted_at := old.certificate_submitted_at;
      new.certificate_reviewed_at := old.certificate_reviewed_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists on_club_guard_certificate on public.clubs;
create trigger on_club_guard_certificate before insert or update on public.clubs
  for each row execute function public.guard_club_certificate();

-- The admins' bell: a certificate waits for a check.
create or replace function public.admin_event_certificate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.certificate_status = 'pending' and new.certificate_url is distinct from old.certificate_url
     and not public.is_test_user(new.owner_id) then
    perform public.admin_event('club.certificate', 'clubs', 'Հավաստագիր՝ ստուգման համար · ' || new.name,
      '/admin/clubs?q=' || public.url_q(new.name));
  end if;
  return new;
end $$;
drop trigger if exists admin_event_certificate on public.clubs;
create trigger admin_event_certificate after update on public.clubs
  for each row execute function public.admin_event_certificate();

-- The pictures: clubs/<uid>/… is the logo; certificates/<uid>/… the document.
drop policy if exists "Club owners upload their certificates" on storage.objects;
create policy "Club owners upload their certificates" on storage.objects for insert to authenticated
  with check (bucket_id = 'club-assets' and (storage.foldername(name))[1] = 'certificates' and (storage.foldername(name))[2] = (auth.uid())::text);
drop policy if exists "Club owners delete their certificates" on storage.objects;
create policy "Club owners delete their certificates" on storage.objects for delete to authenticated
  using (bucket_id = 'club-assets' and (storage.foldername(name))[1] = 'certificates' and (storage.foldername(name))[2] = (auth.uid())::text);
