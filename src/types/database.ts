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
  phone: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface Club {
  id: string;
  owner_id: string; // profiles.id
  name: string;
  tariff: Tariff;
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

export type TourType = "mountain" | "lake" | "other";
export type Difficulty = "easy" | "medium" | "hard" | "prof";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Հեշտ",
  medium: "Միջին",
  hard: "Բարդ",
  prof: "Պրոֆեսիոնալ",
};

export interface Tour {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  regions: string[];
  date: string; // ISO date
  max_participants: number;
  photo_urls: string[];
  type: TourType;
  overnight: boolean;
  difficulty: Difficulty;
  popular: boolean;
  coordinator_phone: string;
  notes: string | null;
  meeting_point: string | null;
  meeting_time: string | null; // "HH:MM" from the time column
  cancel_deadline_hours: number | null;
  created_at: string;
}

export const TYPE_LABELS: Record<TourType, string> = {
  mountain: "Արշավ սարերում",
  lake: "Արշավ լճերի մոտ",
  other: "Այլ",
};

export const ARMENIA_REGIONS = [
  "Երևան",
  "Արագածոտն",
  "Արարատ",
  "Արմավիր",
  "Գեղարքունիք",
  "Կոտայք",
  "Լոռի",
  "Շիրակ",
  "Սյունիք",
  "Վայոց ձոր",
  "Տավուշ",
] as const;

// Tour joined with its club's name — what the home page query returns.
export interface TourWithClub extends Tour {
  club_name: string;
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
