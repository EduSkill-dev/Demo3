-- 0026: a visitor's suggestion reaches the owner only after the visitor
-- confirms the email address they typed, so nobody can write in someone
-- else's name. Signed-in people are stored confirmed (their address is
-- already verified).

alter table contact_messages add column if not exists token uuid not null default gen_random_uuid();
alter table contact_messages add column if not exists confirmed_at timestamptz;
create unique index if not exists contact_messages_token_key on contact_messages (token);

-- Messages sent before this rule count as delivered.
update contact_messages set confirmed_at = created_at where confirmed_at is null;
