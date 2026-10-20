-- 0078: a few practical facts per place (Gor, 2026-10-20): the road from
-- Yerevan (km and about how long), a Yandex Maps link, mobile signal.
alter table public.sights
  add column if not exists distance_km integer check (distance_km is null or distance_km between 0 and 1000),
  add column if not exists drive_minutes integer check (drive_minutes is null or drive_minutes between 0 and 1440),
  add column if not exists map_url text check (map_url is null or map_url ~ '^https://([a-z0-9-]+\.)*yandex\.(ru|com|am|by|kz)/maps'),
  add column if not exists mobile_signal text check (mobile_signal is null or mobile_signal in ('yes', 'partial', 'no'));
