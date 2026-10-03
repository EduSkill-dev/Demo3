-- 0024: bookkeeping for the daily job (/api/cron/daily).
--
--   * package_reminders: one row per reminder sent, so a club gets the
--     7-day and the 2-day notice exactly once per package period
--   * job_runs: when each job last ran (the newsletter digest sends the
--     hikes published since then)
-- Both are written only by the server (service role): RLS on, no policies.

create table if not exists package_reminders (
  club_id uuid not null references clubs (id) on delete cascade,
  ends_at timestamptz not null,
  days int not null check (days in (7, 2)),
  sent_at timestamptz not null default now(),
  primary key (club_id, ends_at, days)
);
alter table package_reminders enable row level security;

create table if not exists job_runs (
  name text primary key,
  last_run_at timestamptz not null
);
alter table job_runs enable row level security;
