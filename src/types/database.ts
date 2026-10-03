// Hand-written types matching supabase/migrations/0001_init.sql.
// Once the project is connected to a real Supabase instance, you can replace
// this file by running `supabase gen types typescript` for full accuracy.

import type { Difficulty, PackageId, Region, Terrain } from "@/lib/catalog";

export type Tariff = PackageId;
export type { Difficulty, Region, Terrain };
export { formatAmd } from "@/lib/catalog";

export interface Profile {
  id: string; // matches auth.users.id
  role: "individual" | "club";
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  gender: string | null;
  email: string;
  phone: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface Club {
  id: string;
  owner_id: string; // profiles.id
  name: string;
  tariff: Tariff | null; // the package bought; see activePackage()
  package_ends_at: string | null;
  photo_url: string | null;
  description: string | null;
  team_info: string | null;
  guides_info: string | null;
  focus_areas: string | null;
  created_at: string;
}

export interface ClubGuide {
  id: string;
  club_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  created_at: string;
}

// The club's "orientation" chips (stored comma-separated in clubs.focus_areas).
export const FOCUS_TAGS = [
  "Լեռներ ու սարեր",
  "Լճեր և ափամերձարշավներ",
  "Պատմամշակութային վայրեր",
  "Անտառներ ու բնություն",
  "Գիշերակացով արշավներ",
  "Հեշտ և ընտանեկան արշավներ",
] as const;

export function parseFocusAreas(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type TourStatus = "active" | "hidden" | "cancelled";

export interface Tour {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  regions: string[]; // Region keys
  date: string; // ISO date
  max_participants: number;
  photo_urls: string[];
  status: TourStatus;
  terrains: string[]; // Terrain keys
  overnight: boolean;
  difficulty: Difficulty;
  popular: boolean;
  coordinator_phone: string;
  notes: string | null;
  meeting_point: string | null;
  meeting_time: string | null; // "HH:MM" from the time column
  price: number; // AMD; 0 = free signup, > 0 goes through the test payment sheet
  created_at: string;
}

// Tour joined with its club's name — what the home page query returns.
export interface TourWithClub extends Tour {
  club_name: string;
}

export interface Booking {
  id: string;
  tour_id: string;
  user_id: string;
  status: "confirmed" | "cancelled";
  seq: number; // k in "k/B": arrival order within the tour, never renumbered
  read_at: string | null; // when the club opened it
  cancelled_at: string | null;
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
  tour_id: string | null;
  message: string;
  read: boolean;
  emailed_at: string | null;
  created_at: string;
}

// Placeholder so `createClient<Database>()` type-checks before you generate
// real Supabase types.
export type Database = any;
