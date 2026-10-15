-- 0064: the address an emailed answer came from, kept when it is not the
-- address the suggestion was left with (the reply address itself is secret,
-- so such a letter is still taken, and the admins see where it came from).
alter table contact_replies add column if not exists sender text;
