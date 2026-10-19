-- 0073: admin sign-in safety and the admin area menu (Gor, 2026-10-20).
--   blocked                 the super admin shut this admin out ("blocked by the chief admin")
--   login_failures          wrong passwords in a row on the main address
--   locked                  a regular admin after 5 wrong passwords in a row:
--                           only a new one-time password from the super admin opens it
--   locked_until            the super admin's main address after 5 in a row: 30 minutes
--   alt_login_failures,
--   alt_locked_until        the same for the super admin's second address, separately
--   phone                   the super admin's phone (shown partly; SMS confirmation later)
--   nav_order               this admin's own order of the menu sections

alter table public.admins add column if not exists blocked boolean not null default false;
alter table public.admins add column if not exists login_failures integer not null default 0;
alter table public.admins add column if not exists locked boolean not null default false;
alter table public.admins add column if not exists locked_until timestamptz;
alter table public.admins add column if not exists alt_login_failures integer not null default 0;
alter table public.admins add column if not exists alt_locked_until timestamptz;
alter table public.admins add column if not exists phone text;
alter table public.admins add column if not exists nav_order text[];

-- A new admin is announced as such (the sign-up trigger made the profile an
-- individual for a moment; that event is replaced).
create or replace function public.admin_event_new_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  select email into v_email from public.profiles where id = new.user_id;
  delete from public.admin_events where kind = 'individual.new' and created_at > now() - interval '10 minutes'
    and title like '%' || coalesce(v_email, '-');
  if not public.is_test_email(v_email) then
    -- perm 'super': only super admins see it (no regular admin holds that permission)
    perform public.admin_event('admin.new', 'super', 'Նոր ադմին՝ ' || coalesce(v_email, '—'), '/admin/admins');
  end if;
  return new;
end $$;
drop trigger if exists admin_event_new_admin on public.admins;
create trigger admin_event_new_admin after insert on public.admins for each row execute function public.admin_event_new_admin();

-- The earlier admin creations shown as "new individual": put them right.
update public.admin_events e set kind = 'admin.new', perm = 'super', title = 'Նոր ադմին՝ ' || p.email, link = '/admin/admins'
  from public.profiles p join public.admins a on a.user_id = p.id
 where e.kind = 'individual.new' and e.title like '%' || p.email;
