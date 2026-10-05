-- 0030: when a blocked account was last emailed about being blocked, so the
-- "forgot password" page cannot be used to flood it with notices.
alter table profiles add column if not exists blocked_notice_at timestamptz;
