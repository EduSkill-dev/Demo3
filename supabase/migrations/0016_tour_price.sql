-- 0016: optional price per tour (AMD).
--   0        = free signup, no card form
--   > 0      = the sign-up card opens the test payment sheet; the amount is
--              recorded in payments.amount and shown on the receipt.
alter table tours add column if not exists price numeric(10, 2) not null default 0;

alter table tours drop constraint if exists tours_price_check;
alter table tours add constraint tours_price_check check (price >= 0);
