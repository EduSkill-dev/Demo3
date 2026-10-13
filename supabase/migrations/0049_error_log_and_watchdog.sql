-- 0049: we hear about faults first.
--
-- error_log     every fault the site catches (server routes, pages in the
--               browser) and every outage the watchdog sees. Server-only.
-- error_alerts  when admins were last emailed about a given fault, so one
--               broken thing sends one email, not hundreds.
-- The watchdog  every 5 minutes the database asks the site's /api/health.
--               Two failed answers in a row = an outage: all admins are
--               emailed straight from the database (through Resend), so the
--               alert does not depend on the site that is down. One more
--               email when it is back. Address and keys are in Supabase
--               Vault ('site_url', 'resend_api_key').

create table if not exists error_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  source text not null check (source in ('server', 'browser', 'monitor')),
  area text not null default '',          -- which part: bookings, payments, auth, page…
  message text not null default '',
  detail text,                            -- stack or extra context
  url text,
  user_id uuid,
  signature text not null default ''      -- same fault = same signature
);
create index if not exists error_log_at_idx on error_log (at desc);
create index if not exists error_log_signature_idx on error_log (signature, at desc);
alter table error_log enable row level security;

create table if not exists error_alerts (
  signature text primary key,
  last_sent timestamptz not null default now()
);
alter table error_alerts enable row level security;

create table if not exists site_checks (
  id bigserial primary key,
  at timestamptz not null default now(),
  request_id bigint,
  ok boolean,          -- null until the answer has been looked at
  status int,
  note text
);
create index if not exists site_checks_at_idx on site_checks (at desc);
alter table site_checks enable row level security;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Everyone who administers the platform (the super admin's second address too).
create or replace function public.admin_emails()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct e), '{}') from (
    select p.email as e from admins a join profiles p on p.id = a.user_id
    union
    select a.alt_email from admins a where a.alt_email is not null
  ) x where e is not null and e <> '';
$$;
revoke all on function public.admin_emails() from public, anon, authenticated;

create or replace function public.watch_site()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_site text := (select decrypted_secret from vault.decrypted_secrets where name = 'site_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_key');
  v_check site_checks%rowtype;
  v_status int;
  v_timed_out boolean;
  v_error text;
  v_found boolean;
  v_down boolean := coalesce((select (value ->> 'down')::boolean from site_settings where key = 'site_watch'), false);
  v_fails int;
  v_subject text;
  v_text text;
begin
  if v_site is null then
    return;
  end if;

  -- 1. Look at the answer to the previous question.
  select * into v_check from site_checks where ok is null order by id desc limit 1;
  if found then
    select r.status_code, r.timed_out, r.error_msg, true into v_status, v_timed_out, v_error, v_found
    from net._http_response r where r.id = v_check.request_id;
    if coalesce(v_found, false) then
      update site_checks set ok = (v_status = 200 and not coalesce(v_timed_out, false)), status = v_status,
        note = left(coalesce(v_error, case when v_timed_out then 'timed out' end, ''), 300)
      where id = v_check.id;
    elsif v_check.at < now() - interval '3 minutes' then
      update site_checks set ok = false, note = 'no answer' where id = v_check.id;
    end if;
  end if;
  update site_checks set ok = false, note = 'no answer' where ok is null and at < now() - interval '15 minutes';

  -- 2. Two failures in a row = down; one success = back.
  select count(*) into v_fails from (
    select ok from site_checks where ok is not null order by id desc limit 2
  ) last2 where ok = false;

  if v_fails = 2 and not v_down then
    select 'HTTP ' || coalesce(status::text, '—') || ' ' || coalesce(note, '') into v_text
    from site_checks where ok is not null order by id desc limit 1;
    insert into error_log (source, area, message, url, signature)
    values ('monitor', 'site', 'Կայքը չի պատասխանում. ' || v_text, v_site || '/api/health', 'monitor:site-down');
    insert into site_settings (key, value) values ('site_watch', jsonb_build_object('down', true, 'since', now()))
    on conflict (key) do update set value = excluded.value, updated_at = now();
    v_subject := 'Culmen. կայքը չի աշխատում';
    v_text := 'Կայքը (' || v_site || ') երկու անգամ անընդմեջ չպատասխանեց ստուգմանը։ Վերջին պատասխանը՝ ' || v_text
      || E'\n\nՍտուգումը կրկնվում է 5 րոպեն մեկ․ երբ կայքը վերականգնվի, կստանաք ևս մեկ նամակ։';
  elsif v_fails = 0 and v_down and exists (select 1 from site_checks where ok is not null) then
    insert into site_settings (key, value) values ('site_watch', jsonb_build_object('down', false, 'since', now()))
    on conflict (key) do update set value = excluded.value, updated_at = now();
    v_subject := 'Culmen. կայքը նորից աշխատում է';
    v_text := 'Կայքը (' || v_site || ') նորից պատասխանում է ստուգմանը։';
  end if;

  if v_subject is not null and v_key is not null and cardinality(admin_emails()) > 0 then
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', 'Culmen <noreply@bolbol.am>', 'to', to_jsonb(admin_emails()), 'subject', v_subject, 'text', v_text)
    );
  end if;

  -- 3. Ask again.
  insert into site_checks (request_id)
  values (net.http_get(url := v_site || '/api/health', timeout_milliseconds := 20000));

  delete from site_checks where at < now() - interval '14 days';
  delete from error_log where at < now() - interval '90 days';
end;
$$;
revoke all on function public.watch_site() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'culmen-watch';
select cron.schedule('culmen-watch', '*/5 * * * *', 'select public.watch_site()');
