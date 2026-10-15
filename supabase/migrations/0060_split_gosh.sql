-- 0060: "Lake Gosh and Goshavank" becomes two places — a lake and a
-- monastery, 2–3 km apart; a hike may go to one of them only. The old place
-- keeps its id as the lake; listings and requests that ticked it get the
-- monastery too (they meant both).
do $$
declare
  lake uuid;
  monastery uuid;
begin
  select id into lake from sights where name_hy = 'Գոշ լիճ և Գոշավանք';
  if lake is null then
    return; -- already split
  end if;
  update sights set name_hy = 'Գոշ լիճ', name_ru = 'Озеро Гош', name_en = 'Lake Gosh', terrain = 'lakes' where id = lake;

  select id into monastery from sights where name_hy = 'Գոշավանք';
  if monastery is null then
    insert into sights (name_hy, name_ru, name_en, region, terrain, difficulty, active)
    values ('Գոշավանք', 'Гошаванк', 'Goshavank', 'tavush', 'heritage', 'easy', true)
    returning id into monastery;
  end if;

  update tours set sight_ids = array_append(sight_ids, monastery)
  where lake = any (sight_ids) and not monastery = any (sight_ids);
  update tour_requests set sight_ids = array_append(sight_ids, monastery)
  where lake = any (sight_ids) and not monastery = any (sight_ids);
end $$;
