-- 0083: a club's name rules, and a renamed club's certificate is checked
-- again (Gor, 2026-10-28).
--   * up to 50 characters; letters of one alphabet (Armenian, Russian or
--     English), digits and "_"; one space between words. Checked for every
--     new club and every renamed one (names given before stay as they are).
--   * a renamed club's certificate goes back to "pending" — the document
--     carries the old name — and the admins' bell asks for a new check.

create or replace function public.club_name_ok(p_name text) returns boolean
language sql immutable set search_path = '' as $$
  select char_length(p_name) between 2 and 50 and (
       (p_name ~ '^[Ա-Ֆա-և0-9_]+( [Ա-Ֆա-և0-9_]+)*$' and p_name ~ '[Ա-Ֆա-և]')
    or (p_name ~ '^[А-яЁё0-9_]+( [А-яЁё0-9_]+)*$' and p_name ~ '[А-яЁё]')
    or (p_name ~ '^[A-Za-z0-9_]+( [A-Za-z0-9_]+)*$' and p_name ~ '[A-Za-z]')
  );
$$;

create or replace function public.guard_club_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.name is distinct from old.name) and not public.club_name_ok(new.name) then
    raise exception 'club_name_invalid: up to 50 characters, letters of one alphabet, digits, "_" and single spaces';
  end if;
  return new;
end $$;
drop trigger if exists on_club_guard_name on public.clubs;
create trigger on_club_guard_name before insert or update of name on public.clubs
  for each row execute function public.guard_club_name();

-- The certificate guard (0081), now also: a new name starts the check again.
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
    elsif new.certificate_url is distinct from old.certificate_url
       or (new.name is distinct from old.name and new.certificate_url is not null) then
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

create or replace function public.admin_event_certificate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.certificate_status = 'pending' and not public.is_test_user(new.owner_id)
     and (new.certificate_url is distinct from old.certificate_url or new.name is distinct from old.name) then
    perform public.admin_event('club.certificate', 'clubs',
      case when new.certificate_url is distinct from old.certificate_url
        then 'Հավաստագիր՝ ստուգման համար · ' || new.name
        else 'Հավաստագիր՝ ակումբը փոխեց անունը («' || old.name || '» → «' || new.name || '»)' end,
      '/admin/clubs?q=' || public.url_q(new.name));
  end if;
  return new;
end $$;
