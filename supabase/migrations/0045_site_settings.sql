-- 0045: small platform-wide switches the admins manage.
--
-- site_settings is a key → JSON value table read and written only by the
-- server (no policies: browsers cannot touch it). First use:
--   'share_networks'  { "facebook": true, "instagram": false, … } — on which
--   social networks a hike's link can be shared from the site.

create table if not exists site_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table site_settings enable row level security;

insert into site_settings (key, value)
values ('share_networks', '{"facebook": false, "instagram": false, "whatsapp": false, "viber": false, "telegram": false}')
on conflict (key) do nothing;
