-- 0042: a readable address for each club page: /clubs/<slug>.
--
-- The slug is made from the club's name when the club is created (Armenian
-- and Russian letters are written in Latin), and the club may change it.
-- Lowercase Latin letters, digits and hyphens, 3–40 characters, unique, and
-- never shaped like an id (old /clubs/<id> links keep working and redirect).

alter table clubs add column if not exists slug text;

create or replace function public.slugify_name(p_name text)
returns text language plpgsql immutable as $$
declare
  v text := lower(coalesce(p_name, ''));
  pairs text[] := array[
    'ու','u', 'և','ev',
    'ա','a','բ','b','գ','g','դ','d','ե','e','զ','z','է','e','ը','y','թ','t','ժ','zh','ի','i','լ','l','խ','kh','ծ','ts','կ','k','հ','h','ձ','dz','ղ','gh','ճ','ch','մ','m','յ','y','ն','n','շ','sh','ո','o','չ','ch','պ','p','ջ','j','ռ','r','ս','s','վ','v','տ','t','ր','r','ց','ts','ւ','v','փ','p','ք','q','օ','o','ֆ','f',
    'а','a','б','b','в','v','г','g','д','d','е','e','ё','e','ж','zh','з','z','и','i','й','y','к','k','л','l','м','m','н','n','о','o','п','p','р','r','с','s','т','t','у','u','ф','f','х','kh','ц','ts','ч','ch','ш','sh','щ','sch','ъ','','ы','y','ь','','э','e','ю','yu','я','ya'
  ];
  i int;
begin
  for i in 1 .. array_length(pairs, 1) by 2 loop
    v := replace(v, pairs[i], pairs[i + 1]);
  end loop;
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := trim(both '-' from left(v, 32));
  return v;
end;
$$;

-- A free slug for this name: the plain one, else with -2, -3, …
create or replace function public.free_club_slug(p_name text, p_club uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_base text := slugify_name(p_name);
  v_slug text;
  n int := 1;
begin
  if char_length(v_base) < 3 then
    v_base := 'club-' || left(replace(p_club::text, '-', ''), 6);
  end if;
  v_slug := v_base;
  while exists (select 1 from clubs where slug = v_slug and id <> p_club) loop
    n := n + 1;
    v_slug := v_base || '-' || n;
  end loop;
  return v_slug;
end;
$$;

create or replace function public.set_club_slug()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := free_club_slug(new.name, new.id);
  else
    new.slug := lower(btrim(new.slug));
  end if;
  return new;
end;
$$;

drop trigger if exists on_club_set_slug on clubs;
create trigger on_club_set_slug
  before insert or update of slug on clubs
  for each row execute function public.set_club_slug();

-- Existing clubs, oldest first, so the first one keeps the plain slug.
do $$
declare r record;
begin
  for r in select id, name from clubs where slug is null order by created_at loop
    update clubs set slug = free_club_slug(r.name, r.id) where id = r.id;
  end loop;
end $$;

create unique index if not exists clubs_slug_key on clubs (slug);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clubs_slug_shape') then
    alter table clubs add constraint clubs_slug_shape check (
      slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40
      and slug !~ '^[0-9a-f]{8}-[0-9a-f]{4}-'
    );
  end if;
end $$;
