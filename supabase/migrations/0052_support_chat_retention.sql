-- 0052: help-chat messages are kept for 3 months.
--
-- Once a day the database removes messages older than that (both the
-- person's and the admins'). The copy in the admins' Telegram group is not
-- ours to delete from here.

select cron.unschedule(jobid) from cron.job where jobname = 'culmen-chat-retention';
select cron.schedule(
  'culmen-chat-retention',
  '30 2 * * *',
  $job$ delete from public.support_messages where created_at < now() - interval '3 months' $job$
);
