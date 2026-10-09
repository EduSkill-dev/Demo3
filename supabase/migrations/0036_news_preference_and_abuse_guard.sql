-- 0036: platform news as a preference of every account, and a guard for the
-- open forms.
--
--   * profiles.platform_news: every registered account receives platform news
--     (new hikes digest, platform updates) unless it switches them off in its
--     dashboard. Notifications about one's own hikes and favourite clubs are
--     not affected.
--   * newsletter_subscribers.sent_at: when the confirmation link last went
--     out, so a pending address is not mailed again and again.
--   * guard_public_action(): counts calls to an open form (newsletter,
--     suggestion, registration). One address calling too often is blocked for
--     a while; too many calls from many addresses pause that form for
--     everyone. Both are written to the activity log.

alter table profiles add column if not exists platform_news boolean not null default true;
alter table newsletter_subscribers add column if not exists sent_at timestamptz;

create table if not exists security_blocks (
  kind text not null check (kind in ('ip', 'function')),
  key text not null,           -- the address, or the form's name
  until timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (kind, key)
);
alter table security_blocks enable row level security;

-- Returns 'ok', 'ip_blocked' or 'paused'.
create or replace function public.guard_public_action(
  p_action text,
  p_ip text,
  p_ip_max int,          -- calls allowed from one address inside the window
  p_global_max int,      -- calls allowed from everyone inside the window
  p_window_minutes int,
  p_ip_block_minutes int,
  p_pause_minutes int
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(mins => p_window_minutes);
  v_key text := 'pa:' || p_action || ':' || p_ip;
  v_count int;
begin
  if exists (select 1 from security_blocks where kind = 'ip' and key = p_ip and until > now()) then
    return 'ip_blocked';
  end if;
  if exists (select 1 from security_blocks where kind = 'function' and key = p_action and until > now()) then
    return 'paused';
  end if;

  -- Housekeeping, now and then.
  if random() < 0.02 then
    delete from rate_hits where at < now() - interval '1 day';
    delete from security_blocks where until < now() - interval '7 days';
  end if;

  insert into rate_hits (key) values (v_key);

  select count(*) into v_count from rate_hits where key = v_key and at >= v_since;
  if v_count > p_ip_max then
    insert into security_blocks (kind, key, until, reason)
    values ('ip', p_ip, now() + make_interval(mins => p_ip_block_minutes), p_action)
    on conflict (kind, key) do update set until = excluded.until, reason = excluded.reason, created_at = now();
    perform log_activity(null, 'security.ip_blocked', 'security', p_ip, p_ip,
      jsonb_build_object('form', p_action, 'calls', v_count, 'minutes', p_ip_block_minutes), p_ip);
    return 'ip_blocked';
  end if;

  select count(*) into v_count from rate_hits where key like 'pa:' || p_action || ':%' and at >= v_since;
  if v_count > p_global_max then
    insert into security_blocks (kind, key, until, reason)
    values ('function', p_action, now() + make_interval(mins => p_pause_minutes), 'too many calls')
    on conflict (kind, key) do update set until = excluded.until, created_at = now();
    perform log_activity(null, 'security.function_paused', 'security', p_action, p_action,
      jsonb_build_object('form', p_action, 'calls', v_count, 'minutes', p_pause_minutes), p_ip);
    return 'paused';
  end if;

  return 'ok';
end;
$$;
revoke all on function public.guard_public_action(text, text, int, int, int, int, int) from public, anon, authenticated;
grant execute on function public.guard_public_action(text, text, int, int, int, int, int) to service_role;
