-- 0041: an optional emergency contact on a booking.
--
-- Who can read it:
--   * bookings.emergency_contact_*  — the participant and the club that runs
--     the hike (the existing bookings policies), plus the server.
--   * emergency_contacts            — the contact a person asked to remember
--     for next time: that person only. It is NOT kept on profiles, because a
--     club can read the profile of anyone who ever applied to it.
-- Browsers cannot write bookings, so only the server sets the booking's copy.

alter table bookings add column if not exists emergency_contact_name text;
alter table bookings add column if not exists emergency_contact_phone text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_emergency_contact_shape') then
    alter table bookings add constraint bookings_emergency_contact_shape check (
      (emergency_contact_name is null and emergency_contact_phone is null)
      or (char_length(emergency_contact_name) between 1 and 80 and emergency_contact_phone ~ '^[+0-9 ()-]{6,20}$')
    ) not valid;
  end if;
end $$;

create table if not exists emergency_contacts (
  user_id uuid primary key references profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (phone ~ '^[+0-9 ()-]{6,20}$'),
  updated_at timestamptz not null default now()
);

alter table emergency_contacts enable row level security;

drop policy if exists "People manage their own emergency contact" on emergency_contacts;
create policy "People manage their own emergency contact" on emergency_contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
