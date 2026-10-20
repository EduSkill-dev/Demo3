-- 0080: the Yandex link field is gone (coordinates replaced it in 0079);
-- dropped once no deployed code read it.
alter table public.sights drop column if exists map_url;
