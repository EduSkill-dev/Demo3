-- Tours can now span multiple regions (marzes), and require a coordinator
-- phone number + an optional "what to bring" notes field.

alter table tours add column if not exists regions text[] not null default '{}';
update tours set regions = array[region] where region is not null and (regions is null or array_length(regions, 1) is null);
alter table tours drop column if exists region;

alter table tours add column if not exists coordinator_phone text not null default '';
alter table tours add column if not exists notes text;

-- Enforce non-empty phone going forward (existing rows already backfilled above).
alter table tours drop constraint if exists tours_coordinator_phone_not_empty;
alter table tours add constraint tours_coordinator_phone_not_empty
  check (length(trim(coordinator_phone)) > 0) not valid;
