-- 0038: plans are edited by the super admin, not written in code.
--
-- `packages.config` holds every capability of a plan, keyed as in
-- src/lib/plans/registry.ts (numbers and yes/no flags). The older columns
-- (max_listings, max_per_tour, shows_ratings, shows_comments, monthly_report,
-- analytics) stay in place as the seed and as a fallback, but nothing reads
-- them once a key is present in `config`.
--   * is_available = false shows the plan as "coming soon": it cannot be chosen.
--   * price_amd stays its own column (the admin page edits it too).

alter table packages add column if not exists config jsonb not null default '{}';
alter table packages add column if not exists is_available boolean not null default true;
alter table packages add column if not exists updated_at timestamptz not null default now();

-- Seed: what each plan had, plus the starting values of the new capabilities.
-- Keys already present are kept, so re-running never undoes an admin's edit.
update packages p set config = jsonb_build_object(
    'max_active_tours', p.max_listings,
    'max_participants_per_tour', p.max_per_tour,
    'public_show_rating', p.shows_ratings,
    'public_show_comments', p.shows_comments,
    'dashboard_registrants_list', true,
    'dashboard_comments_tab', p.id <> 'start',
    'registrants_csv_export', p.id <> 'start',
    'waitlist', p.id <> 'start',
    'planner_other_clubs', true,
    'share_buttons', true,
    'monthly_report', p.monthly_report,
    'analytics', p.analytics
  ) || p.config;

-- The limits the triggers enforce now come from the config.
create or replace function public.tariff_max_listings(p_tariff tariff)
returns int language sql stable as $$
  select coalesce((select coalesce((config ->> 'max_active_tours')::int, max_listings) from packages where id = p_tariff), 0);
$$;

create or replace function public.tariff_max_participants(p_tariff tariff)
returns int language sql stable as $$
  select coalesce((select coalesce((config ->> 'max_participants_per_tour')::int, max_per_tour) from packages where id = p_tariff), 0);
$$;
