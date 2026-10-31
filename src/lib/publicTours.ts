import { createClient } from "@/lib/supabase/server";
import type { Tour } from "@/types/database";
import { getPlans } from "@/lib/plans/server";
import { clubConfig } from "@/lib/plans/registry";
import { getSightNames } from "@/lib/sights";
import { getLikeCounts } from "@/lib/likes";

export type PublicClubInfo = {
  id: string;
  name: string;
  photo: string | null;
  // Present when the club's package shows ratings to the public — 0/5 (0)
  // until the first review.
  rating: { average: number; count: number } | null;
  certified: boolean; // an admin approved its certificate (the blue seal)
};

export type PublicTour = Tour & {
  club: PublicClubInfo;
  taken: number; // confirmed seats
  likes: number; // thumbs-up from people who took part
  sights: { id: string; name: string }[]; // the ticked sights, named in the reader's language
  cap: number; // the seats the club set for this tour; 0 = sign-up closed
};

// Tours the public may see and book: active, not in the past. Soonest first.
// Optionally only one club's tours.
//   range   (calendar, feeds) every hike that touches these days instead —
//           past ones included; "to" may be left out.
//   tourId  just this hike, whatever its date.
export async function getPublicTours(
  opts: { clubId?: string; range?: { from: string; to?: string }; tourId?: string } = {}
): Promise<PublicTour[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("tours")
    .select("*, clubs(id, name, photo_url, tariff, package_ends_at, plan_overrides, applications_blocked, certificate_status)")
    .eq("status", "active")
    .eq("admin_hidden", false)
    .order("date", { ascending: true });
  if (opts.tourId) query = query.eq("id", opts.tourId);
  else if (opts.range) {
    query = query.or(`date.gte.${opts.range.from},end_date.gte.${opts.range.from}`);
    if (opts.range.to) query = query.lte("date", opts.range.to);
  } else query = query.gte("date", today);
  if (opts.clubId) query = query.eq("club_id", opts.clubId);
  const { data } = await query;

  type Row = Tour & {
    clubs: { id: string; name: string; photo_url: string | null; tariff: string | null; package_ends_at: string | null; plan_overrides: unknown; applications_blocked: boolean; certificate_status: string | null } | null;
  };
  const rows = ((data ?? []) as Row[]).filter((t) => t.clubs);
  if (rows.length === 0) return [];

  const plans = await getPlans();
  const sightNames = await getSightNames();
  const likes = await getLikeCounts(rows.map((t) => t.id));
  const [{ data: seats }, { data: ratings }] = await Promise.all([
    supabase.rpc("tours_seats_taken", { p_tours: rows.map((t) => t.id) }),
    supabase.from("club_rating_summary").select("club_id, average, count").in("club_id", [...new Set(rows.map((t) => t.club_id))]),
  ]);
  const taken = new Map(((seats ?? []) as { tour_id: string; taken: number }[]).map((s) => [s.tour_id, s.taken]));
  const rating = new Map(
    ((ratings ?? []) as { club_id: string; average: number; count: number }[]).map((r) => [r.club_id, r])
  );

  return rows.map(({ clubs, ...tour }) => {
    const r = rating.get(clubs!.id);
    return {
      ...tour,
      club: {
        id: clubs!.id,
        name: clubs!.name,
        photo: clubs!.photo_url,
        rating: clubConfig(plans, clubs).public_show_rating ? { average: Number(r?.average ?? 0), count: r?.count ?? 0 } : null,
        certified: clubs!.certificate_status === "approved",
      },
      likes: likes.tours.get(tour.id) ?? 0,
      sights: (tour.sight_ids ?? []).flatMap((id) => (sightNames.has(id) ? [{ id, name: sightNames.get(id)! }] : [])),
      taken: taken.get(tour.id) ?? 0,
      // 0 = sign-up closed (an admin switched the club's applications off).
      cap: clubs!.applications_blocked ? 0 : tour.max_participants,
    };
  });
}
