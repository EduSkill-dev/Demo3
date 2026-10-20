-- 0079: a place's position as coordinates instead of a Yandex link (Gor,
-- 2026-10-20): the page opens it in the device's own maps app.
alter table public.sights
  add column if not exists lat double precision check (lat is null or lat between -90 and 90),
  add column if not exists lng double precision check (lng is null or lng between -180 and 180),
  add constraint sights_lat_lng_together check ((lat is null) = (lng is null));
-- map_url is dropped in 0080, after the code that reads it is gone.
