# Highland — hiking & tour aggregator for Armenia

## What this is
A web platform (mobile version later) that aggregates Armenia's hiking clubs and
tour operators. Individuals discover and book hikes/tours; clubs manage their
listings through a paid, tiered dashboard.

## MVP scope

### Individual users (free)
- Register/login with: first name, last name, age, gender, email (required).
  Payment card field exists in the UI but is optional — no real payments in v1.
- Search/filter tours by region, club, and date.
- View tour details and sign up (no real payment processing yet — the
  button/flow exists, backend payment logic is a later phase).
- Dashboard: save favorite clubs, receive notifications about new tours from
  those clubs, and view history of tours/clubs they've participated with.
- Rate a tour only if they participated in it; rate a club only if they've
  participated in at least one of its tours.

### Clubs / organizers (paid, tiered)
Three tariff names shown at launch: **START**, **Advanced**, **Pro** — only
START and Advanced are functional in v1; Pro is visible but disabled/"coming
soon".

| Limit | START | Advanced |
|---|---|---|
| Active tour listings | 2 | 5 |
| Max registrants per tour | 5 | 20 |
| Club rating & comments visible to public | No | Yes |
| Applicant/comment visibility in dashboard | Registrant list only | Registrant list + comments |

Club dashboard sections: **Listings** (create/edit/delete tours — title,
description, region/direction, photos), **Applications** (who signed up per
tour), **Comments** (Advanced only).

Tariff limits should be enforced by a single centralized policy layer, not
scattered checks, so adding Pro or changing limits later is a small change.

### Later (not in MVP, but keep the data model open to them)
- Real payment processing for both individual bookings and club subscriptions.
- Notifications delivery (email/push) — v1 can just store the notification
  records.
- Third-party ads (outdoor gear shops, transport services) — never competing
  clubs.
- Mobile app (React Native/Expo, reusing the same Supabase backend).

## Architecture
- **Web app** (Next.js) and later **Mobile app** (React Native) both talk to
  the same backend.
- **Backend API** (Next.js API routes to start), with three logical service
  areas:
  - **Auth & users** — registration, login, roles (individual vs club).
  - **Clubs & tours** — club profiles, tariff assignment and enforcement,
    tour/listing CRUD.
  - **Bookings & ratings** — tour sign-ups, applicant lists, ratings and
    comments.
- **Database**: single PostgreSQL instance (via Supabase), shared by all
  service areas.

## Tech stack
- **Framework**: Next.js (React, TypeScript)
- **Backend-as-a-service**: Supabase — Postgres database, built-in Auth,
  Storage (for tour photos)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel (app) + Supabase (database/auth/storage)
- **Future mobile**: React Native / Expo, same Supabase backend

## First implementation steps (suggested order)
1. Scaffold Next.js + TypeScript + Tailwind project.
2. Connect Supabase project; set up Auth (individual + club roles).
3. Data model: `users`, `clubs`, `tariffs`, `tours`, `bookings`,
   `ratings`, `comments`, `notifications`.
4. Individual flow: register → search/filter tours → view tour → sign up
   (mock payment button).
5. Club flow: register → pick tariff → dashboard → create/edit/delete tour
   (enforce tariff limits).
6. Ratings & comments (gate comments visibility by tariff).
7. Notifications (store-only for v1).
