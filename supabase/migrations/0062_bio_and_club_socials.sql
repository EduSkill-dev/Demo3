-- 0062: a few words of one's own in the hiker passport, and the clubs'
-- social pages.
--
-- passport_bio: up to 300 characters, shown on the public passport. Free
-- text, but no links, email addresses or phone numbers (the rules are in the
-- Terms; admins can remove a text that breaks them).
-- instagram_url / facebook_url / linkedin_url: each must really be a page of
-- that network — the site checks as one types, the database here.

alter table profiles add column if not exists passport_bio text;
alter table profiles drop constraint if exists profiles_passport_bio_check;
alter table profiles add constraint profiles_passport_bio_check check (
  passport_bio is null or (
    char_length(passport_bio) <= 300
    and passport_bio !~* '(https?://|www\.|[a-z0-9-]+\.(com|am|ru|net|org|io|me|info|biz|co|app|link|site|online|shop)(\s|/|$)|[^\s@]+@[^\s@]+\.[a-z]{2,})'
    and passport_bio !~ '\+?\d[\d\s()\-]{7,}\d'
  )
);

alter table clubs add column if not exists instagram_url text;
alter table clubs add column if not exists facebook_url text;
alter table clubs add column if not exists linkedin_url text;
alter table clubs drop constraint if exists clubs_instagram_url_check;
alter table clubs add constraint clubs_instagram_url_check check (
  instagram_url is null or instagram_url ~* '^https://(www\.)?instagram\.com/[a-z0-9._]{1,30}/?$'
);
alter table clubs drop constraint if exists clubs_facebook_url_check;
alter table clubs add constraint clubs_facebook_url_check check (
  facebook_url is null or (facebook_url ~* '^https://(www\.|m\.|web\.)?(facebook|fb)\.com/[^\s]+$' and char_length(facebook_url) <= 300)
);
alter table clubs drop constraint if exists clubs_linkedin_url_check;
alter table clubs add constraint clubs_linkedin_url_check check (
  linkedin_url is null or linkedin_url ~* '^https://([a-z]{2,3}\.)?linkedin\.com/(company|in|school|showcase)/[^\s/?#]+/?$'
);
