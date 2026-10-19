-- 0075: a signed-in session must not change a key holder's password or
-- address on its own. Supabase lets any session call updateUser({password})
-- straight from the browser, and the "forgot password" link opens such a
-- session too — that would skip the key and the 10-minute rule. So for an
-- account with a security key the change goes through only when the server
-- has just allowed it (admin_password_grants, one use, one minute).

create table if not exists public.admin_password_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '1 minute'
);
alter table public.admin_password_grants enable row level security;

create or replace function public.guard_key_holder_credentials() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.encrypted_password is distinct from old.encrypted_password or new.email is distinct from old.email)
     and exists (select 1 from public.admin_keys where user_id = new.id) then
    delete from public.admin_password_grants where user_id = new.id and expires_at > now();
    if not found then
      raise exception 'credentials of a security-key account change only through the admin area';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_key_holder_credentials on auth.users;
create trigger guard_key_holder_credentials before update on auth.users
  for each row execute function public.guard_key_holder_credentials();
