-- 0040: hikes that last several days.
--
-- tours.end_date is the last day (null = a one-day hike). The calendar and
-- the .ics feeds show the hike on every day it covers; everything else
-- (limits, cancel window, "past") keeps going by the first day.

alter table tours add column if not exists end_date date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tours_end_date_range') then
    alter table tours add constraint tours_end_date_range
      check (end_date is null or (end_date >= date and end_date <= date + 60)) not valid;
  end if;
end $$;
