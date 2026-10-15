-- 0059: a place's height above sea level, in whole metres (below sea level
-- is negative). Set by admins; shown on the place's card and page.
alter table sights add column if not exists elevation int;
alter table sights drop constraint if exists sights_elevation_range;
alter table sights add constraint sights_elevation_range check (elevation is null or elevation between -500 and 9000);
