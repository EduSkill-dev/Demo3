-- 0044: when a custom request was cancelled by its author.
--
-- The server counts a person's cancellations of the last 24 hours: after the
-- tenth, no more cancelling and no new requests until 24 hours have passed
-- since the earliest of those ten.

alter table tour_requests add column if not exists closed_at timestamptz;
create index if not exists tour_requests_user_closed_idx on tour_requests (user_id, closed_at desc) where closed_at is not null;
