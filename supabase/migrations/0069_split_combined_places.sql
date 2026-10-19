-- 0069: one place, one kind. Two more entries joined two places under one
-- name (Gor, 2026-10-19: "a group that visits Saghmosavank does not have to
-- go down into the gorge"); each becomes two places, as Gosh did in 0060.
-- The old row keeps its id as the first place; listings and requests that
-- ticked it get the second one too (they meant both). An organiser whose
-- route skips one of them unticks it.
do $$
declare
  first_id uuid;
  second_id uuid;
begin
  -- Saghmosavank (a monastery) and the Kasagh Gorge.
  select id into first_id from sights where name_hy = 'Սաղմոսավանք և Քասաղի կիրճ';
  if first_id is not null then
    update sights set name_hy = 'Սաղմոսավանք', name_ru = 'Сагмосаванк', name_en = 'Saghmosavank', terrain = 'heritage', difficulty = 'easy' where id = first_id;
    select id into second_id from sights where name_hy = 'Քասաղի կիրճ';
    if second_id is null then
      insert into sights (name_hy, name_ru, name_en, region, terrain, difficulty, active)
      values ('Քասաղի կիրճ', 'Ущелье Касах', 'Kasagh Gorge', 'aragatsotn', 'gorges', 'medium', true)
      returning id into second_id;
    end if;
    update tours set sight_ids = array_append(sight_ids, second_id) where first_id = any (sight_ids) and not second_id = any (sight_ids);
    update tour_requests set sight_ids = array_append(sight_ids, second_id) where first_id = any (sight_ids) and not second_id = any (sight_ids);
  end if;

  -- Tatev Monastery and the Wings of Tatev (the cableway).
  select id into first_id from sights where name_hy = 'Տաթև և Տաթևի թևեր';
  if first_id is not null then
    update sights set name_hy = 'Տաթևի վանք', name_ru = 'Татевский монастырь', name_en = 'Tatev Monastery', terrain = 'heritage', difficulty = 'easy' where id = first_id;
    select id into second_id from sights where name_hy = 'Տաթևի թևեր';
    if second_id is null then
      insert into sights (name_hy, name_ru, name_en, region, terrain, difficulty, active)
      values ('Տաթևի թևեր', 'Крылья Татева', 'Wings of Tatev', 'syunik', 'other', 'easy', true)
      returning id into second_id;
    end if;
    update tours set sight_ids = array_append(sight_ids, second_id) where first_id = any (sight_ids) and not second_id = any (sight_ids);
    update tour_requests set sight_ids = array_append(sight_ids, second_id) where first_id = any (sight_ids) and not second_id = any (sight_ids);
  end if;
end $$;
