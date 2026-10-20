// Server-only: the places (sights) as the public pages show them — name in
// the reader's language, photo, text and counts (hearts, hikes).
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/i18n/server";
import { getAllSights, nameIn, type Sight } from "@/lib/sights";
import { getPublicTours } from "@/lib/publicTours";
import type { Locale } from "@/i18n/config";

export type Place = {
  id: string;
  name: string;
  region: string;
  terrain: string | null;
  difficulty: string | null;
  elevation: number | null; // metres above sea level
  relativeHeight: number | null; // above the surroundings; null for gorges
  distanceKm: number | null; // by road from Yerevan
  driveMinutes: number | null;
  coords: { lat: number; lng: number } | null;
  signal: "yes" | "partial" | "no" | null; // mobile signal
  photo: string | null; // the admins' photo, else the newest photo of a hike there
  description: string | null;
  likes: number;
  hikes: number; // published hikes there, past and coming
  upcoming: number; // hikes there the public can see and book now (the Tours list's rules)
};

type Stats = { sight_id: string; likes: number; hikes: number; upcoming: number; tour_photo: string | null };

// Counts change with every booking and heart; a minute old is fine.
const loadStats = unstable_cache(
  async (): Promise<Stats[]> => {
    try {
      const { data } = await createAdminClient().rpc("sight_stats");
      return (data ?? []) as Stats[];
    } catch {
      return [];
    }
  },
  ["sight-stats"],
  { revalidate: 60 }
);

const textIn = (s: Sight, locale: Locale) =>
  (locale === "ru" ? s.description_ru : locale === "en" ? s.description_en : s.description_hy) || s.description_hy || null;

export async function getPlaces(): Promise<Place[]> {
  const [sights, stats, locale, tours] = await Promise.all([getAllSights(), loadStats(), getLocale(), getPublicTours()]);
  const byId = new Map(stats.map((s) => [s.sight_id, s]));
  // Coming hikes counted like the hike list counts them: not past, not
  // closed by an admin, not hidden by the club, the club's plan still on.
  const coming = new Map<string, number>();
  for (const t of tours) for (const id of t.sight_ids ?? []) coming.set(id, (coming.get(id) ?? 0) + 1);
  return sights
    .filter((s) => s.active)
    .map((s) => {
      const st = byId.get(s.id);
      return {
        id: s.id,
        name: nameIn(s, locale),
        region: s.region,
        terrain: s.terrain,
        difficulty: s.difficulty,
        elevation: s.elevation,
        relativeHeight: s.terrain === "gorges" ? null : s.relative_height,
        distanceKm: s.distance_km,
        driveMinutes: s.drive_minutes,
        coords: s.lat !== null && s.lng !== null ? { lat: s.lat, lng: s.lng } : null,
        signal: s.mobile_signal,
        photo: s.photo_url || st?.tour_photo || null,
        description: textIn(s, locale),
        likes: st?.likes ?? 0,
        hikes: st?.hikes ?? 0,
        upcoming: coming.get(s.id) ?? 0,
      };
    });
}

export async function getPlace(id: string): Promise<Place | null> {
  return (await getPlaces()).find((p) => p.id === id) ?? null;
}
