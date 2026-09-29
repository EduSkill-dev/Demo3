-- Expose aggregate platform counts without exposing individual profile data.
create or replace function public.get_about_stats()
returns table (
  clubs_count bigint,
  users_count bigint,
  tours_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.clubs),
    (select count(*) from public.profiles),
    (select count(*) from public.tours);
$$;

revoke all on function public.get_about_stats() from public;
grant execute on function public.get_about_stats() to anon, authenticated;
