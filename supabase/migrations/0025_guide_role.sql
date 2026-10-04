-- 0025: a guide's position (e.g. hiking guide, instructor), shown under the
-- name on the club page. Free text, so clubs can write what fits them.
alter table club_guides add column if not exists role text;
