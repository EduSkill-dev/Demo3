# Highland — starter scaffold

This is the initial Next.js + Supabase scaffold for the Highland hiking
platform, matching `PROJECT_BRIEF.md`.

## Testing

```
node scripts/e2e-flows.cjs          # 35 end-to-end checks, live database
node scripts/run-sql.cjs <file.sql>  # apply a migration from the terminal
node scripts/run-sql.cjs -e "select 1"
```

`e2e-flows.cjs` creates throwaway accounts and deletes them afterwards, so it
is safe to re-run. It covers: signup triggers, favorites, booking + seat
caps, rating rules, tariff listing caps, applicant visibility, club profile
data, guides, notifications, the cancel flow, and the privilege guards
(role/tariff escalation, clubs booking tours). It exits non-zero when a check
fails.

## Running SQL without the dashboard

Add a personal access token (https://supabase.com/dashboard/account/tokens) to
`.env.local` (gitignored):

```
SUPABASE_ACCESS_TOKEN=sbp_...
```

Then any migration can be run from the terminal — no DB password needed:

```
node scripts/run-sql.cjs supabase/migrations/0011_notifications_ratings.sql
node scripts/run-sql.cjs -e "select count(*) from tours"
```

The project ref is derived from `NEXT_PUBLIC_SUPABASE_URL` (set
`SUPABASE_PROJECT_REF` only if that ever changes). The token is org-wide, so
keep its expiry short and revoke it when you stop needing it.

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

## Update 3 (booking flow)
- `/tours/[id]` — a real tour page (back link uses browser history, all
  club-provided fields, seats left, sign-up / cancel card).
- Tour cards on `/` and `/tours` now open that page instead of a modal.
- `/dashboard/applications` — who signed up per tour (name, age, contact),
  with cancel/restore; `/dashboard/tariff` — switch START ↔ Advanced.
- Hitting the listing limit shows an explanation with a "Փոխել տարիֆը" button.
- `/login?next=/tours/...` returns you to the tour you wanted to join.
- **Run `supabase/migrations/0009_booking_flow.sql` in the Supabase SQL
  editor.** It adds the listing/participant cap triggers, `seats_taken()`,
  and RLS so clubs can read their own applicants — without it the seat count
  and the Applications tab stay empty.

## Update 4 (club data)
- `/dashboard/club` ("Ակումբի տվյալներ" tab): edit the club's about text
  (creation & history), pick orientation chips (mountains, historical sites,
  ...), and manage guides — add one opens name / surname / photo upload right
  away, and any guide can be removed with the "−" button.
- `/clubs/[id]` now shows that about text, the orientation chips, and the
  guides with their photos.
- **Run `supabase/migrations/0010_club_guides.sql`** — it creates
  `club_guides` and the public `club-assets` storage bucket with the upload
  policies. Without it, adding a guide reports an error in `/dashboard/club`.

## Update 5 (ratings, comments, notifications)
- `/tours/[id]`: tour ratings (average + comments) and a score/comment form
  that only unlocks once you have a confirmed booking on that tour.
- `/clubs/[id]`: the same form for rating the club itself — attendees only,
  exactly what RLS enforces.
- `/dashboard/comments`: comments the club's tours received, authors and all
  — gated to Advanced/Pro, START gets the "change tariff" pitch instead.
- `/account/notifications` + a 🔔 badge in the navbar: the rows written by the
  "new tour published" trigger, with read/unread state.
- **Run `supabase/migrations/0011_notifications_ratings.sql`** (idempotent).
  It also backfills `get_about_stats`, the `profiles.phone/photo_url` columns
  and the notification trigger — on this project 0004 and 0008 were never run,
  so the About stats showed "—", profile saving failed, and no notification
  was ever created.

## Update 6 (tour photos)
- Clubs upload up to 5 photos per listing right in `TourForm` (preview grid,
  remove before saving, uploaded on submit). The first photo becomes the card
  image on `/` and `/tours`, and the tour page shows the rest as thumbnails.
- Storage path is `tours/<user id>/...`, locked down by the section-7 policies
  in migration 0011 — owners can only write inside their own folder.

## Update 8 (meeting details + club logo)
- `TourForm` gained հավաքի վայր, հավաքի ժամ and չեղարկման ժամկետ (hours) — the
  fields the FAQ page always promised. The tour page lists them and the
  sign-up card repeats the exact cancellation window once you register.
- `/dashboard/club` gained an "Ակումբի նկար" uploader, stored under
  `clubs/<user id>/...` in the same bucket and shown on the clubs card and
  on the club page header.
- Migration 0012 was applied from the terminal with
  `node scripts/run-sql.cjs supabase/migrations/0012_meeting_and_logo.sql`.

## Update 9 (tests, and the bugs they found)
- `scripts/e2e-flows.cjs` — the project's first test harness, 35 checks over
  the real database.
- Migration 0013 closed four privilege gaps the suite proved: club accounts
  could book tours, any club could set its tariff to `pro`, an individual
  could flip their own `role`, and an individual could create a club row.
- Migration 0014 fixed the recursion 0013 introduced (the clubs policy asked
  profiles, the profiles policy asked clubs), which had broken saving a
  club's description/orientation/photo. The role check now lives in a
  security-definer trigger instead of the policy.
- App fixes: cancelling right after signing up now cancels the real booking
  (the row id was empty), the profile email stays in sync with auth email,
  `/dashboard/listings/new` no longer hangs when the club row is missing,
  the navbar badge refreshes after leaving the inbox, and the tour form
  enforces the participant cap while editing too.

## Update 7 (cancel a booking)
- `/account` ("Իմ արշավները") has a "Չեղարկել գրանցումը" button per tour. The seat
  frees up immediately (capacity counts confirmed bookings only) and the club
  sees the row dimmed as cancelled in its Applications tab.

## Update 10 (payments, email, HTTP e2e)
- Payment sheet + mock gateway (`src/lib/mockPayment.ts`): accepts test card
  numbers (4242… succeeds, 4000…002 declines, 4000…995 insufficient, 4000…069
  expired). No real money moves.
- `/api/payments/charge` POST — `kind: "booking"` charges the tour's price and
  creates a confirmed booking; `kind: "subscription"` upgrades a club's tariff.
  Declined payments are recorded too.
- `/api/bookings` POST — `action: "cancel"` cancels a booking; without an
  action it books (or re-activates a previously cancelled signup).
- `/api/tours/announce` POST — emails followers of the club that published a
  new tour. Stamps `emailed_at` once per notification row.
- Emails go through Resend (`src/lib/email.ts`) when `RESEND_API_KEY` is set,
  otherwise through Gmail SMTP when `GMAIL_USER` + `GMAIL_APP_PASSWORD` are.
  With neither (or with `EMAIL_DISABLED` set, as the e2e suite does) every
  `sendEmail` call returns `{ skipped: true }` and the app keeps working.
  Site messages and new-subscriber notices go to `CONTACT_INBOX`, else to
  `GMAIL_USER`.
- `e2e-flows.cjs` now starts the Next.js dev server and exercises the three
  API routes over HTTP with a cookie built from a real anon-key session. Checks
  cover: free booking + cancel, paid booking (success + decline), subscription
  upgrade, tour announce, and the email no-op path.

## Update 11 (server-only writes)
- Bookings, payments and club tariffs are written only by the API routes,
  using `SUPABASE_SERVICE_ROLE_KEY` (now required in every environment,
  including Vercel). Browsers keep read access through RLS.
- `/api/bookings` refuses paid tours (402); they go through
  `/api/payments/charge`. Switching to START goes through the same route
  without a card.
- New clubs always start on START; the signup form no longer offers plans.
- Clubs can no longer cancel or restore an applicant's booking.
- `src/middleware.ts` refreshes the session and keeps `/account` for
  individuals and `/dashboard` for clubs on the server side.
- Migration: `0017_server_only_writes.sql`.

## Update 12 (packages, rules, i18n, auth, header/footer)
- Packages live in `src/lib/catalog.ts` and the `packages` table (0018):
  START 2/5 free, Advanced 5/10 20 000 ֏, PRO 20/20 40 000 ֏ per month.
  `/dashboard/packages` buys, extends (7 days before expiry) and shows receipts.
- Booking rules in the database: confirmed email, active tour, club with an
  active package, free seat; cancelling only more than 48 h before.
- UI text lives in `src/i18n/dictionaries/{hy,ru,en}.ts`; the language and
  the light/dark theme are cookies set from the header.
- Sign-up collects birth date and phone (individuals) or phone (clubs) and
  requires email confirmation. Auth emails return to `/auth/confirm`,
  `/auth/recover` or `/auth/email-change`.
- `node scripts/configure-auth.cjs` turns confirmation on and sets the
  redirect allow-list. Supabase's built-in mailer sends only ~2 emails per
  hour; with `RESEND_API_KEY` and a verified `EMAIL_FROM` domain, run it with
  `--smtp` to send auth mail through Resend and apply the Armenian templates.
  Re-run it after deploying to a new domain (`NEXT_PUBLIC_SITE_URL`).
- Footer on every page: double opt-in newsletter (`/api/newsletter`,
  `/newsletter/confirm|unsubscribe`) and suggestions (`/api/contact`,
  forwarded to `CONTACT_INBOX`).
- Migrations: `0018_packages_and_tour_rules.sql`, `0019_signup_fields_and_newsletter.sql`.

## Update 13 (club and account dashboards, public pages, daily job)
- Club dashboard: Listings (A/B applications with unread badges, hide,
  cancel instead of delete once people signed up), Applications (k/B,
  unread in bold, details modal), Club details (photo, about, phone, focus,
  guides with bios), Packages.
- Account: Hikes (cancel only >48 h before), History with receipts
  (`/receipts/<id>?print=1` → Save as PDF), Favourite clubs, Notifications,
  Reviews, Personal details (photo, email change with confirmation,
  password, account deletion that keeps history as "deleted user").
- Public: Hikes page with URL filters and "See more" modal, club pages with
  Back-to-filters, heart, guides, upcoming hikes and reviews.
- Every screen is translated (hy/ru/en). `node scripts/check-i18n.cjs`
  lists missing ru/en keys.
- Daily job `/api/cron/daily` (scheduled in `vercel.json`, needs
  `CRON_SECRET`): package reminders 7 and 2 days before expiry, and a
  digest of new hikes to confirmed newsletter subscribers.
- Demo data: `node scripts/seed-demo.cjs` (`--remove` to delete).
- Migrations 0020–0024.

### Order of migrations
Run every file in `supabase/migrations/` in name order with
`node scripts/run-sql.cjs <file>` (0002 does not exist; that is expected).

## Admin area

`/admin` is for accounts with the `admin` role (Armenian only).

- **Super admin** — created once with
  `node scripts/create-super-admin.cjs <email> <second-email>`; the script
  prints a one-time password that must be replaced at the first sign-in.
- **Admins** — created by the super admin at `/admin/admins`, each with one
  address, a one-time password and ticked permissions: individuals, clubs,
  tours, pages. Only the super admin has a second sign-in address.
- **Site texts** — `/admin/pages` stores replacements for the dictionaries in
  `site_texts`; `makeT` lays them over the built-in texts.
- **Accounts** — freeze (signed in, read-only), block (cannot sign in) or
  delete with everything the account owns. **Tours** can be taken off the
  site (`tours.admin_hidden`), not edited.
- **Logs** — `activity_log`, written by database triggers and the server
  routes. The super admin sees everyone; admins see individuals and clubs.

All of it goes through `/api/admin` and the service role; see migrations
0027–0028.

## Custom requests and sights

- **Sights** (`sights`, seeded by migration 0033) are the platform's list of
  places. Clubs tick them on a listing, individuals on a request; admins
  manage the list at `/admin/sights` (entries are hidden, never deleted).
- **Requests** — an individual describes a trip at `/account/requests`
  (people, dates, regions, terrain, sights, overnight, budget, free text).
  Contact details in the free text are refused (`hasContactDetails`).
- **`/requests`** lists the open requests, newest first, for clubs only.
  A club with an active package sends an offer (price per person, date,
  message); its offers live at `/dashboard/offers`.
- The individual accepts one offer: the others are declined, the request
  closes, and only then do the two sides see each other's contacts.
- Everything is written through `/api/requests`; row-level security lets a
  request be read by its author and by clubs, an offer by its club and the
  request's author.
- The cancel window (24/36/48/60 h) is set **per listing**
  (`tours.cancel_hours`).
