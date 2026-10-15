// Server-only: hiker passports (migration 0057). Only people who switched
// their passport on are listed, by their first name.
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { badgesFor, type Badge, type PassportCounts } from "@/lib/badges";
import { getPlaces, type Place } from "@/lib/places";

export type Hiker = {
  id: string;
  name: string;
  photo: string | null;
  hikes: number;
  places: number;
  regions: number;
  badges: Badge[];
};

type Row = {
  user_id: string; first_name: string | null; last_initial: string | null; photo_url: string | null;
  hikes: number; places: number; mountains: number; lakes: number; heritage: number; kinds: number; regions: number;
};

const loadHikers = unstable_cache(
  async (): Promise<Row[]> => {
    try {
      const { data } = await createAdminClient().rpc("public_hikers");
      return (data ?? []) as Row[];
    } catch {
      return [];
    }
  },
  ["public-hikers"],
  { revalidate: 60 }
);

const nameOf = (r: Row) => r.first_name?.trim() || "—";

// The Hikers page: most places first, then most hikes.
export async function getPublicHikers(): Promise<Hiker[]> {
  return (await loadHikers())
    .map((r) => ({
      id: r.user_id,
      name: nameOf(r),
      photo: r.photo_url,
      hikes: r.hikes,
      places: r.places,
      regions: r.regions,
      badges: badgesFor(r),
    }))
    .sort((a, b) => b.places - a.places || b.hikes - a.hikes || a.name.localeCompare(b.name));
}

export type VisitedPlace = Place & { visits: number; lastDate: string };
export type Passport = { places: VisitedPlace[]; counts: PassportCounts; regions: number; badges: Badge[] };

// The places a person has been to. For someone else this returns nothing
// unless they show their passport (the database checks it).
export async function getPassport(userId: string, own = false): Promise<Passport> {
  const db = own ? await createClient() : createAdminClient();
  const [{ data }, places] = await Promise.all([db.rpc("passport_places", { p_user: userId }), getPlaces()]);
  const byId = new Map(places.map((p) => [p.id, p]));
  const visited = ((data ?? []) as { sight_id: string; visits: number; last_date: string }[])
    .map((r) => {
      const p = byId.get(r.sight_id);
      return p ? { ...p, visits: r.visits, lastDate: r.last_date } : null;
    })
    .filter((p): p is VisitedPlace => !!p)
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  const count = (kind: string) => visited.filter((p) => p.terrain === kind).length;
  const counts: PassportCounts = {
    mountains: count("mountains"),
    lakes: count("lakes"),
    heritage: count("heritage"),
    kinds: new Set(visited.map((p) => p.terrain).filter((k) => k && k !== "other")).size,
  };
  return { places: visited, counts, regions: new Set(visited.map((p) => p.region)).size, badges: badgesFor(counts) };
}
