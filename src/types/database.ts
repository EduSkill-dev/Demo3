// Hand-written types matching supabase/migrations/0001_init.sql.
// Once the project is connected to a real Supabase instance, you can replace
// this file by running `supabase gen types typescript` for full accuracy.

export type Tariff = "start" | "advanced" | "pro";

export interface Profile {
  id: string; // matches auth.users.id
  role: "individual" | "club";
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  gender: string | null;
  email: string;
  created_at: string;
}

export interface Club {
  id: string;
  owner_id: string; // profiles.id
  name: string;
  tariff: Tariff;
  created_at: string;
}

export interface Tour {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  region: string;
  date: string; // ISO date
  max_participants: number;
  photo_urls: string[];
  created_at: string;
}

export interface Booking {
  id: string;
  tour_id: string;
  user_id: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

export interface Rating {
  id: string;
  user_id: string;
  tour_id: string | null; // rating a specific tour
  club_id: string | null; // rating a club overall
  score: number; // 1-5
  comment: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  club_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

// Tariff limits — the single source of truth referenced by app logic.
// Keep this in sync with the check constraints in the migration.
export const TARIFF_LIMITS: Record<
  Tariff,
  { maxListings: number; maxParticipants: number; showRatings: boolean }
> = {
  start: { maxListings: 2, maxParticipants: 5, showRatings: false },
  advanced: { maxListings: 5, maxParticipants: 20, showRatings: true },
  pro: { maxListings: Infinity, maxParticipants: Infinity, showRatings: true },
};

// Placeholder so `createClient<Database>()` type-checks before you generate
// real Supabase types.
export type Database = any;
