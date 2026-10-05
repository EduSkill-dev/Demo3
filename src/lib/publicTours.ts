import { createClient } from "@/lib/supabase/server";
import type { Tour } from "@/types/database";
import { PACKAGES, activePackage } from "@/lib/catalog";

export type PublicClubInfo = {
  id: string;
  name: string;
  cancel_hours: number;
  // Present only when the club's package shows ratings to the public.
  rating: { average: number; count: number } | null;
};

export type PublicTour = Tour & {
  club: PublicClubInfo;
  taken: number; // confirmed seats
  cap: number; // seats the club's package allows on this tour; 0 = sign-up closed
};

// Tours the public may see and book: active, not in the past, run by a club
// whose package has not lapsed (an expired club's tours drop off the site
// until it renews). Soonest first. Optionally only one club's tours.
export async function getPublicTours(opts: { clubId?: string } = {}): Promise<PublicTour[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("tours")
    .select("*, clubs(id, name, tariff, package_ends_at, applications_blocked, cancel_hours)")
    .eq("status", "active")
    .eq("admin_hidden", false)
    .gte("date", today)
    .order("date", { ascending: true });
  if (opts.clubId) query = query.eq("club_id", opts.clubId);
  const { data } = await query;

  type Row = Tour & {
    clubs: { id: string; name: string; tariff: string | null; package_ends_at: string | null; applications_blocked: boolean; cancel_hours: number } | null;
  };
  const rows = ((data ?? []) as Row[]).filter((t) => t.clubs && activePackage(t.clubs));
  if (rows.length === 0) return [];

  const [{ data: seats }, { data: ratings }] = await Promise.all([
    supabase.rpc("tours_seats_taken", { p_tours: rows.map((t) => t.id) }),
    supabase.from("club_rating_summary").select("club_id, average, count").in("club_id", [...new Set(rows.map((t) => t.club_id))]),
  ]);
  const taken = new Map(((seats ?? []) as { tour_id: string; taken: number }[]).map((s) => [s.tour_id, s.taken]));
  const rating = new Map(
    ((ratings ?? []) as { club_id: string; average: number; count: number }[]).map((r) => [r.club_id, r])
  );

  return rows.map(({ clubs, ...tour }) => {
    const pkg = activePackage(clubs!)!;
    const r = rating.get(clubs!.id);
    return {
      ...tour,
      club: {
        id: clubs!.id,
        name: clubs!.name,
        cancel_hours: clubs!.cancel_hours,
        rating: PACKAGES[pkg].showsRatings && r ? { average: Number(r.average), count: r.count } : null,
      },
      taken: taken.get(tour.id) ?? 0,
      // 0 = sign-up closed (an admin switched the club's applications off).
      cap: clubs!.applications_blocked ? 0 : Math.min(tour.max_participants, PACKAGES[pkg].maxPerTour),
    };
  });
}
