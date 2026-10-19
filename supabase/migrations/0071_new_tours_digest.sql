-- 0071: two switches instead of one (Gor, 2026-10-19).
--   platform_news     news from the platform: updates, rule changes — on by default
--   new_tours_digest  the email about every newly published hike — on for
--                     individuals, OFF by default for clubs
-- Until now platform_news decided both. An individual keeps what they had;
-- clubs start with the digest off.

alter table public.profiles add column if not exists new_tours_digest boolean;
update public.profiles set new_tours_digest = case when role = 'club' then false else coalesce(platform_news, true) end
 where new_tours_digest is null;

create or replace function public.default_new_tours_digest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.new_tours_digest is null then
    new.new_tours_digest := new.role is distinct from 'club';
  end if;
  -- An account turned into a club (Google sign-up → club) starts without the digest.
  if tg_op = 'UPDATE' and new.role = 'club' and old.role is distinct from 'club' then
    new.new_tours_digest := false;
  end if;
  return new;
end $$;
drop trigger if exists default_new_tours_digest on public.profiles;
create trigger default_new_tours_digest before insert or update of role on public.profiles
  for each row execute function public.default_new_tours_digest();

alter table public.profiles alter column new_tours_digest set not null;
