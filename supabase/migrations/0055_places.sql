-- 0055: sights become places with a kind and a difficulty, and a listing
-- takes its tags from the places it visits.
--
-- sights.terrain     what kind of place it is (the same keys as a listing's
--                    terrains: mountains, lakes, gorges, caves, waterfalls,
--                    forest, heritage, other)
-- sights.difficulty  how hard reaching it is (easy … prof)
-- A listing with places gets, from them and nothing else: its regions (every
-- place's region), its terrains (every place's kind) and its difficulty (the
-- hardest place). The trigger below writes those, so they cannot disagree.
-- tours.bring_items  what to bring, picked from a fixed list (keys in code);
--                    the free text stays in tours.notes.
-- A hike that has already taken place keeps its date: "publish again" makes
-- a copy instead of moving the old one.

alter table sights add column if not exists terrain text;
alter table sights add column if not exists difficulty text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sights_terrain_known') then
    alter table sights add constraint sights_terrain_known
      check (terrain is null or terrain in ('mountains', 'lakes', 'gorges', 'caves', 'waterfalls', 'forest', 'heritage', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sights_difficulty_known') then
    alter table sights add constraint sights_difficulty_known
      check (difficulty is null or difficulty in ('easy', 'medium', 'hard', 'prof'));
  end if;
end $$;

-- A first guess for the places already listed; admins correct it in Admin → Sights.
update sights s set terrain = v.terrain, difficulty = v.difficulty
from (values
  ('Ամբերդ ամրոց', 'heritage', 'easy'), ('Արա լեռ', 'mountains', 'medium'), ('Արագած լեռ', 'mountains', 'hard'),
  ('Արտենի լեռ', 'mountains', 'medium'), ('Հովհաննավանք', 'heritage', 'easy'), ('Սաղմոսավանք և Քասաղի կիրճ', 'gorges', 'medium'),
  ('Քարի լիճ', 'lakes', 'easy'), ('Խոսրովի անտառ', 'forest', 'medium'), ('Խոր Վիրապ', 'heritage', 'easy'),
  ('Վեդիի կիրճ', 'gorges', 'medium'), ('Զվարթնոց', 'heritage', 'easy'), ('Սարդարապատ', 'heritage', 'easy'),
  ('Աժդահակ լեռ', 'mountains', 'hard'), ('Արմաղան լեռ', 'mountains', 'medium'), ('Հայրավանք', 'heritage', 'easy'),
  ('Նորատուսի խաչքարեր', 'heritage', 'easy'), ('Սևանա լիճ', 'lakes', 'easy'), ('Սևանավանք', 'heritage', 'easy'),
  ('Բջնի ամրոց', 'heritage', 'easy'), ('Գառնու տաճար', 'heritage', 'easy'), ('Գեղարդ', 'heritage', 'easy'),
  ('Թեղենիս լեռ', 'mountains', 'medium'), ('Ծաղկաձոր', 'mountains', 'medium'), ('Հատիս լեռ', 'mountains', 'medium'),
  ('Քարերի սիմֆոնիա', 'gorges', 'easy'), ('Ախթալա', 'heritage', 'easy'), ('Լոռի բերդ', 'heritage', 'easy'),
  ('Հաղպատ', 'heritage', 'easy'), ('Սանահին', 'heritage', 'easy'), ('Ստեփանավանի դենդրոպարկ', 'forest', 'easy'),
  ('Օձուն', 'heritage', 'easy'), ('Արփի լիճ', 'lakes', 'easy'), ('Թռչկանի ջրվեժ', 'waterfalls', 'medium'),
  ('Մարմաշեն', 'heritage', 'easy'), ('Զորաց քարեր', 'heritage', 'easy'), ('Խնձորեսկ', 'caves', 'easy'),
  ('Խուստուփ լեռ', 'mountains', 'hard'), ('Շաքիի ջրվեժ', 'waterfalls', 'easy'), ('Ուխտասար', 'mountains', 'hard'),
  ('Սատանի կամուրջ', 'other', 'easy'), ('Տաթև և Տաթևի թևեր', 'heritage', 'easy'), ('Գոշ լիճ և Գոշավանք', 'lakes', 'easy'),
  ('Դիլիջանի ազգային պարկ', 'forest', 'medium'), ('Դիմաց լեռ', 'mountains', 'medium'), ('Ենոքավան', 'forest', 'medium'),
  ('Լաստիվեր', 'caves', 'medium'), ('Հաղարծին', 'heritage', 'easy'), ('Պարզ լիճ', 'lakes', 'easy'),
  ('Արենիի քարանձավ', 'caves', 'easy'), ('Գնդեվանք', 'heritage', 'easy'), ('Նորավանք', 'heritage', 'easy'),
  ('Ջերմուկի ջրվեժ', 'waterfalls', 'easy'), ('Սելիմի քարավանատուն', 'heritage', 'easy'), ('Սմբատաբերդ', 'heritage', 'medium'),
  ('Էրեբունի ամրոց', 'heritage', 'easy')
) as v(name, terrain, difficulty)
where s.name_hy = v.name and s.terrain is null;
update sights set terrain = coalesce(terrain, 'other'), difficulty = coalesce(difficulty, 'medium');

alter table tours add column if not exists bring_items text[] not null default '{}';

-- The listing's tags follow its places.
create or replace function public.tour_tags_from_places()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_level text;
begin
  if coalesce(cardinality(new.sight_ids), 0) = 0 then
    return new;
  end if;
  select coalesce(array_agg(distinct s.region order by s.region), '{}') into new.regions from sights s where s.id = any(new.sight_ids);
  select coalesce(array_agg(distinct s.terrain order by s.terrain), '{}') into new.terrains from sights s where s.id = any(new.sight_ids) and s.terrain is not null;
  select s.difficulty into v_level from sights s
  where s.id = any(new.sight_ids) and s.difficulty is not null
  order by array_position(array['easy', 'medium', 'hard', 'prof'], s.difficulty) desc
  limit 1;
  if v_level is not null then
    new.difficulty := v_level::difficulty;
  end if;
  return new;
end;
$$;

drop trigger if exists on_tour_tags_from_places on tours;
create trigger on_tour_tags_from_places
  before insert or update of sight_ids, regions, terrains, difficulty on tours
  for each row execute function public.tour_tags_from_places();

-- A past hike's date is history.
create or replace function public.keep_past_tour_date()
returns trigger
language plpgsql
as $$
begin
  if old.date < (now() at time zone 'Asia/Yerevan')::date and new.date is distinct from old.date
     and coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'Անցած արշավի ամսաթիվը փոխել չի կարելի․ օգտագործեք «Հրապարակել նորից»։';
  end if;
  return new;
end;
$$;

drop trigger if exists on_tour_keep_past_date on tours;
create trigger on_tour_keep_past_date
  before update of date on tours
  for each row execute function public.keep_past_tour_date();
