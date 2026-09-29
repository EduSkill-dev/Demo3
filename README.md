# Highland — starter scaffold

This is the initial Next.js + Supabase scaffold for the Highland hiking
platform, matching `PROJECT_BRIEF.md`.

## What's here
- `src/app/` — pages: landing (`/`), tour discovery (`/tours`), `/login`,
  `/register`
- `src/lib/supabase/` — browser and server Supabase clients
- `src/types/database.ts` — data model types + `TARIFF_LIMITS` (the single
  source of truth for START/Advanced/Pro limits)
- `supabase/migrations/0001_init.sql` — database schema: profiles, clubs,
  tours, bookings, ratings, notifications, favorite_clubs

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create a free project at supabase.com, then copy `.env.local.example` to
   `.env.local` and fill in your project's URL and anon key (Project
   Settings > API).
3. Run the migration: open the Supabase SQL editor and paste in
   `supabase/migrations/0001_init.sql`, or use the Supabase CLI:
   ```
   supabase db push
   ```
4. Start the dev server:
   ```
   npm run dev
   ```
5. Visit `http://localhost:3000`.

## Not built yet (by design — see PROJECT_BRIEF.md)
- Club registration + tariff selection flow
- Club dashboard (listings / applications / comments)
- Tour sign-up / booking flow
- Ratings & comments UI
- Notifications delivery
- Payments (individual bookings and club subscriptions)

## Suggested next step
Wire up `/register` for clubs (a second form, or a role toggle on the
existing one), then build the club dashboard's "Listings" section so clubs
can create tours — that unblocks `/tours` showing real data.

## Update 2 (home page, filters, role-based signup)
- Home page: hero, tour grid with details modal, right-side filters.
- Put your own hero photo at `public/images/ararat-hero.jpg`.
- Run `supabase/migrations/0002_tour_fields.sql` in the Supabase SQL editor
  (after 0001). It adds tour type/overnight, club policies, and a trigger that
  creates the profile (and club) automatically on signup.
- /register asks: individual or club. /register/club has START/Advanced/Pro.
- Nav links (/about, /clubs, /faq) and /dashboard are not built yet.
