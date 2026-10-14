-- 0056: a new listing must say where and when the group meets.
-- Checked on insert and whenever those fields change; older listings that
-- lack them are left alone until edited.

create or replace function public.require_meeting_details()
returns trigger
language plpgsql
as $$
begin
  if coalesce(btrim(new.meeting_point), '') = '' or new.meeting_time is null then
    raise exception 'Նշեք հավաքի վայրը և ժամը։';
  end if;
  return new;
end;
$$;

drop trigger if exists on_tour_require_meeting on tours;
create trigger on_tour_require_meeting
  before insert or update of meeting_point, meeting_time on tours
  for each row execute function public.require_meeting_details();
