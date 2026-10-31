-- 0086: the reminder before Advanced ends is a setting now (default 3 days),
-- so the table no longer names the allowed days.
alter table public.package_reminders drop constraint if exists package_reminders_days_check;
alter table public.package_reminders add constraint package_reminders_days_check check (days between 0 and 60);
