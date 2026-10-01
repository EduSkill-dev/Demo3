-- Profile fields needed for the individual account area, and a trigger that
-- records a notification for everyone who favorited a club when that club
-- publishes a new tour. (Actually emailing them is a separate, later
-- integration — this just writes the notification row.)

alter table profiles add column if not exists phone text;
alter table profiles add column if not exists photo_url text;

create or replace function public.notify_favorites_on_new_tour()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  club_name_value text;
begin
  select name into club_name_value from clubs where id = new.club_id;

  insert into notifications (user_id, club_id, message)
  select user_id, new.club_id,
    coalesce(club_name_value, 'Ակումբը') || ' հրապարակեց նոր արշավ՝ "' || new.title || '"'
  from favorite_clubs
  where club_id = new.club_id;

  return new;
end;
$$;

drop trigger if exists on_tour_created_notify_favorites on tours;
create trigger on_tour_created_notify_favorites
  after insert on tours
  for each row execute function public.notify_favorites_on_new_tour();
