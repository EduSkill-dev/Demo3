-- 0067: the club's public contacts. clubs.phone is the number given at sign-up
-- (for us, and the default coordinator number in a new listing); it is no
-- longer shown on the club page. What the page shows is what the club fills
-- in here, each optional.

alter table public.clubs add column if not exists contact_phone text;
alter table public.clubs add column if not exists contact_email text;
alter table public.clubs add column if not exists contact_address text;

alter table public.clubs drop constraint if exists clubs_contact_phone_check;
alter table public.clubs add constraint clubs_contact_phone_check
  check (contact_phone is null or contact_phone ~ '^[+0-9 ()-]{8,20}$');
alter table public.clubs drop constraint if exists clubs_contact_email_check;
alter table public.clubs add constraint clubs_contact_email_check
  check (contact_email is null or (contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and length(contact_email) <= 120));
alter table public.clubs drop constraint if exists clubs_contact_address_check;
alter table public.clubs add constraint clubs_contact_address_check
  check (contact_address is null or length(contact_address) between 3 and 160);
