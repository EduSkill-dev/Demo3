-- 0019: what the new sign-up forms collect, and a double opt-in newsletter.
--
--   * individuals: birth date (replaces the typed-in age) and phone
--   * clubs: phone
--   * newsletter: confirmed via an emailed link, with an unsubscribe token
--   * suggestions need an email or a phone to answer to
--   * both forms are written by API routes (service role), not browsers

alter table profiles add column if not exists birth_date date;
alter table clubs add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_role user_role := case when meta->>'role' = 'club' then 'club'::user_role else 'individual'::user_role end;
  club_name_value text := nullif(trim(meta->>'club_name'), '');
  phone_value text := nullif(trim(meta->>'phone'), '');
  birth date;
begin
  begin
    birth := nullif(meta->>'birth_date', '')::date;
  exception when others then
    birth := null;
  end;

  insert into public.profiles (id, role, first_name, last_name, birth_date, gender, email, phone)
  values (
    new.id, new_role,
    nullif(trim(meta->>'first_name'), ''), nullif(trim(meta->>'last_name'), ''),
    birth, nullif(meta->>'gender', ''), coalesce(new.email, ''),
    case when new_role = 'individual' then phone_value end
  );

  if new_role = 'club' then
    insert into public.clubs (owner_id, name, phone)
    values (new.id, coalesce(club_name_value, 'Նոր ակումբ'), phone_value);
  end if;

  return new;
end;
$$;

-- Newsletter: double opt-in --------------------------------------------------
alter table newsletter_subscribers add column if not exists token uuid not null default gen_random_uuid();
alter table newsletter_subscribers add column if not exists confirmed_at timestamptz;
alter table newsletter_subscribers add column if not exists unsubscribed_at timestamptz;
alter table newsletter_subscribers add column if not exists locale text not null default 'hy';
create unique index if not exists newsletter_subscribers_token_key on newsletter_subscribers (token);

-- Rows from before double opt-in were typed in by the subscriber themselves.
update newsletter_subscribers set confirmed_at = created_at where confirmed_at is null;

drop policy if exists "Anyone can subscribe" on newsletter_subscribers;

-- Suggestions: one way to reply is required ----------------------------------
alter table contact_messages alter column email drop not null;
alter table contact_messages alter column phone drop not null;
alter table contact_messages drop constraint if exists contact_messages_reply_to;
alter table contact_messages add constraint contact_messages_reply_to
  check (nullif(trim(coalesce(email, '')), '') is not null or nullif(trim(coalesce(phone, '')), '') is not null)
  not valid;

drop policy if exists "Anyone can send a message" on contact_messages;
