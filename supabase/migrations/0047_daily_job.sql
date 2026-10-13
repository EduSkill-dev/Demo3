-- 0047: the daily job is started by the database.
--
-- Once a day (06:00 UTC, 10:00 in Yerevan) pg_cron asks the site to run
-- /api/cron/daily (package reminders, the news digest). The hosting no
-- longer needs a scheduler of its own. The address and the secret are kept
-- in Supabase Vault under the names 'site_url' and 'cron_secret' — they are
-- not in this file.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'culmen-daily';

select cron.schedule(
  'culmen-daily',
  '0 6 * * *',
  $job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'site_url') || '/api/cron/daily',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 60000
  );
  $job$
);
