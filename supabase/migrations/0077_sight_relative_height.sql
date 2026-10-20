-- 0077: a place's relative height (how far above its surroundings it rises),
-- shown on the place page and card; not shown for gorges (Gor, 2026-10-20).
alter table public.sights add column if not exists relative_height integer
  check (relative_height is null or relative_height between 0 and 5000);
