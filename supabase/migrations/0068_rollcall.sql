-- 0068: the roll call by Telegram.
--   * A club's people connect to the bot once, through the club's secret link
--     (t.me/<bot>?start=c_<code>); the bot learns their Telegram account and
--     keeps them in club_tg_people.
--   * Each listing names who marks attendance (tour_rollcall, at least one;
--     the form insists).
--   * 10 minutes before the meeting time the bot sends each of them the list
--     with ✅/❌ buttons (rollcall_messages); a tap writes bookings.attended.

-- The club's link code. Its own table: clubs rows are public.
create table if not exists public.club_tg_codes (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_at timestamptz not null default now()
);
alter table public.club_tg_codes enable row level security;
drop policy if exists "Club owner reads its code" on public.club_tg_codes;
create policy "Club owner reads its code" on public.club_tg_codes for select
  using (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()));

-- The club's code, made on first ask; with p_new a fresh one (old links stop working).
create or replace function public.club_tg_code(p_new boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_code text;
begin
  select id into v_club from public.clubs where owner_id = auth.uid();
  if v_club is null then raise exception 'Ակումբը չի գտնվել։'; end if;
  if p_new then delete from public.club_tg_codes where club_id = v_club; end if;
  insert into public.club_tg_codes (club_id) values (v_club) on conflict (club_id) do nothing;
  select code into v_code from public.club_tg_codes where club_id = v_club;
  return v_code;
end $$;
revoke all on function public.club_tg_code(boolean) from public, anon;
grant execute on function public.club_tg_code(boolean) to authenticated;

-- People who connected (written by the bot with the service role).
create table if not exists public.club_tg_people (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  tg_user_id bigint not null,
  chat_id bigint not null,
  name text not null,
  username text,
  created_at timestamptz not null default now(),
  unique (club_id, tg_user_id)
);
alter table public.club_tg_people enable row level security;
drop policy if exists "Club owner reads its people" on public.club_tg_people;
create policy "Club owner reads its people" on public.club_tg_people for select
  using (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()));
drop policy if exists "Club owner removes its people" on public.club_tg_people;
create policy "Club owner removes its people" on public.club_tg_people for delete
  using (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()));

-- Who marks attendance on a hike.
create table if not exists public.tour_rollcall (
  tour_id uuid not null references public.tours(id) on delete cascade,
  person_id uuid not null references public.club_tg_people(id) on delete cascade,
  primary key (tour_id, person_id)
);
alter table public.tour_rollcall enable row level security;
drop policy if exists "Club owner manages its roll call" on public.tour_rollcall;
create policy "Club owner manages its roll call" on public.tour_rollcall for all
  using (exists (select 1 from public.tours t join public.clubs c on c.id = t.club_id where t.id = tour_id and c.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.tours t join public.clubs c on c.id = t.club_id where t.id = tour_id and c.owner_id = auth.uid())
    and exists (select 1 from public.club_tg_people p join public.tours t on t.club_id = p.club_id where p.id = person_id and t.id = tour_id)
  );

-- The lists sent, so every copy is updated after a tap.
create table if not exists public.rollcall_messages (
  tour_id uuid not null references public.tours(id) on delete cascade,
  person_id uuid references public.club_tg_people(id) on delete set null,
  chat_id bigint not null,
  message_id bigint not null,
  sent_at timestamptz not null default now(),
  primary key (chat_id, message_id)
);
alter table public.rollcall_messages enable row level security; -- server only

alter table public.tours add column if not exists rollcall_sent_at timestamptz;
alter table public.tours add column if not exists rollcall_reminded_at timestamptz;

-- The bot's tap: the same rules as mark_attendance, but the right to mark
-- comes from being named on this hike's roll call.
create or replace function public.rollcall_mark(p_booking uuid, p_tg_user bigint, p_attended boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_tour uuid; v_date date; v_status text;
begin
  select b.tour_id, t.date, b.status::text into v_tour, v_date, v_status
    from public.bookings b join public.tours t on t.id = b.tour_id where b.id = p_booking;
  if v_tour is null then return 'missing'; end if;
  if not exists (select 1 from public.tour_rollcall r join public.club_tg_people p on p.id = r.person_id
                 where r.tour_id = v_tour and p.tg_user_id = p_tg_user) then return 'forbidden'; end if;
  if v_status <> 'confirmed' then return 'cancelled'; end if;
  if v_date > (now() at time zone 'Asia/Yerevan')::date then return 'early'; end if;
  update public.bookings set attended = p_attended where id = p_booking;
  return 'ok';
end $$;
revoke all on function public.rollcall_mark(uuid, bigint, boolean) from public, anon, authenticated;

-- Every 5 minutes the site sends the lists that are due (and the evening reminders).
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'culmen-rollcall';
  perform cron.schedule('culmen-rollcall', '*/5 * * * *', $c$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'site_url') || '/api/cron/rollcall',
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      timeout_milliseconds := 30000
    );
  $c$);
end $$;
