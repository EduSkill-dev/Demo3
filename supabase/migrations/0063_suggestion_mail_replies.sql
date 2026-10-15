-- 0063: the author of a suggestion can answer back by email.
-- Each suggestion has its own reply address (reply-<token>@<domain>); a
-- letter to it arrives through Cloudflare Email Routing and an email Worker
-- (workers/mail-in) at /api/mail/inbound, and is kept here as the author's
-- turn in the conversation (author = 'person', via = 'email').
alter table contact_messages add column if not exists reply_token uuid not null default gen_random_uuid();
create unique index if not exists contact_messages_reply_token_key on contact_messages (reply_token);

alter table contact_replies add column if not exists author text not null default 'admin';
alter table contact_replies drop constraint if exists contact_replies_author_check;
alter table contact_replies add constraint contact_replies_author_check check (author in ('admin', 'person'));
alter table contact_replies alter column admin_name drop not null;
alter table contact_replies drop constraint if exists contact_replies_via_check;
alter table contact_replies add constraint contact_replies_via_check check (via in ('site', 'telegram', 'email'));
create index if not exists contact_replies_tg_idx on contact_replies (tg_message_id) where tg_message_id is not null;
