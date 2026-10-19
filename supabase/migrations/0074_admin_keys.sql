-- 0074: the super admin's sign-in, hardened (Gor, 2026-10-20).
--   * two addresses, two passwords: the main address keeps the account's
--     password; the second has its own (alt_password_hash, bcrypt). Until it
--     is first set, the second address takes the main password and that
--     becomes its own from then on;
--   * security keys (YubiKey, WebAuthn): a new device opens the admin area
--     only after the key — then the device is trusted (admin_devices);
--   * recovery codes: ten one-time codes that always let the super admin in
--     with either address (passwords changed, addresses locked, key lost);
--   * changing the OTHER address's password needs the key and a link sent to
--     that address, both within 10 minutes (admin_secure_ops). SMS later.
-- Every table here is read and written by the server only (RLS, no policies).

create extension if not exists pgcrypto with schema extensions;

alter table public.admins add column if not exists alt_password_hash text;

create table if not exists public.admin_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,        -- base64url COSE key
  counter bigint not null default 0,
  transports text[],
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create table if not exists public.admin_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('register', 'verify', 'other')),
  challenge text not null,
  expires_at timestamptz not null default now() + interval '5 minutes'
);
create table if not exists public.admin_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,        -- sha256 of the cookie's secret
  label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked boolean not null default false
);
create table if not exists public.admin_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create table if not exists public.admin_secure_ops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target text not null check (target in ('main', 'alt')),  -- whose password changes
  key_ok boolean not null default false,
  email_ok boolean not null default false,
  email_token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default now() + interval '10 minutes',
  done_at timestamptz
);
alter table public.admin_keys enable row level security;
alter table public.admin_challenges enable row level security;
alter table public.admin_devices enable row level security;
alter table public.admin_recovery_codes enable row level security;
alter table public.admin_secure_ops enable row level security;

-- The second address's password, kept as a bcrypt hash.
create or replace function public.admin_set_alt_password(p_user uuid, p_password text) returns void
language sql security definer set search_path = '' as $$
  update public.admins set alt_password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 10)) where user_id = p_user;
$$;
create or replace function public.admin_check_alt_password(p_user uuid, p_password text) returns boolean
language sql security definer set search_path = '' as $$
  select coalesce((select alt_password_hash = extensions.crypt(p_password, alt_password_hash) from public.admins where user_id = p_user and alt_password_hash is not null), false);
$$;

-- Recovery codes: a fresh set replaces the old one; using one spends it.
create or replace function public.admin_new_recovery_codes(p_user uuid, p_codes text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.admin_recovery_codes where user_id = p_user;
  insert into public.admin_recovery_codes (user_id, code_hash)
  select p_user, extensions.crypt(c, extensions.gen_salt('bf', 8)) from unnest(p_codes) c;
end $$;
create or replace function public.admin_use_recovery_code(p_user uuid, p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.admin_recovery_codes
   where user_id = p_user and used_at is null and code_hash = extensions.crypt(p_code, code_hash) limit 1;
  if v_id is null then return false; end if;
  update public.admin_recovery_codes set used_at = now() where id = v_id;
  return true;
end $$;

revoke all on function public.admin_set_alt_password(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_check_alt_password(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_new_recovery_codes(uuid, text[]) from public, anon, authenticated;
revoke all on function public.admin_use_recovery_code(uuid, text) from public, anon, authenticated;
