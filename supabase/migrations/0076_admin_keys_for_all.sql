-- 0076: every admin may have security keys (at most two, Gor 2026-10-20).
-- A device trusted through a recovery code may remove keys without touching
-- one for a short while (both keys lost); otherwise removing needs a touch.
alter table public.admin_devices add column if not exists by_recovery boolean not null default false;
alter table public.admin_challenges drop constraint if exists admin_challenges_purpose_check;
alter table public.admin_challenges add constraint admin_challenges_purpose_check check (purpose in ('register', 'verify', 'other', 'remove'));
