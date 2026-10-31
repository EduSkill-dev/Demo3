// Server-only: the home page's two "most active" cards, worked out from
// what really happened on the platform.
//
// Hiker of the quarter — the person who took part in the most hikes this
//   calendar quarter (confirmed sign-ups on hikes that have taken place,
//   not marked absent). A tie goes to whoever reached that number first.
//   Shown as first name + the first letter of the surname.
//
// Club of the month — the best score over the last 30 days among clubs with
//   an active plan and at least one hike held in that time:
//     40%  activity      hikes held (8 or more = full marks) and how varied
//                        they were (regions visited, 5 or more = full marks)
//     35%  satisfaction  the club's rating, steadied so that two 5-star
//                        votes do not beat fifty 4.8s, plus comments
//                        received in the period (10 or more = full marks)
//     25%  reach         people who actually came (60 or more = full marks)
//
// Either card is null while there is nothing to show yet.
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInYerevan, addDays } from "@/lib/calendar";

export type Spotlight = {
  hiker: { name: string; photo: string | null; hikes: number } | null;
  club: { name: string; photo: string | null; href: string; hikes: number; people: number } | null;
};

const RATING_PRIOR = 4.0; // what a club is assumed to deserve before anyone votes
const RATING_PRIOR_VOTES = 5;
const part = (value: number, full: number) => Math.min(value, full) / full;

export const getSpotlight = cache(async (): Promise<Spotlight> => {
  try {
    const db = createAdminClient();
    const today = todayInYerevan();
    const quarterStart = `${today.slice(0, 4)}-${String(Math.floor((+today.slice(5, 7) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
    const monthStart = addDays(today, -30);
    const from = quarterStart < monthStart ? quarterStart : monthStart;

    const { data: tourRows } = await db
      .from("tours")
      .select("id, club_id, date, regions")
      .neq("status", "cancelled")
      .eq("admin_hidden", false) // hikes an admin took off the site do not count
      .gte("date", from)
      .lte("date", today);
    const tours = (tourRows ?? []) as { id: string; club_id: string; date: string; regions: string[] }[];
    if (tours.length === 0) return { hiker: null, club: null };
    const tourById = new Map(tours.map((x) => [x.id, x]));

    const { data: bookingRows } = await db
      .from("bookings")
      .select("user_id, tour_id, attended, created_at")
      .eq("status", "confirmed")
      .in("tour_id", tours.map((x) => x.id))
      .not("user_id", "is", null);
    const bookings = ((bookingRows ?? []) as { user_id: string; tour_id: string; attended: boolean | null; created_at: string }[]).filter((b) => b.attended !== false);

    /* ---------------------------------------------------------------- hiker */
    const perHiker = new Map<string, { hikes: number; last: string }>();
    for (const b of bookings) {
      if (tourById.get(b.tour_id)!.date < quarterStart) continue;
      const h = perHiker.get(b.user_id) ?? { hikes: 0, last: "" };
      h.hikes++;
      if (b.created_at > h.last) h.last = b.created_at;
      perHiker.set(b.user_id, h);
    }
    const best = [...perHiker.entries()].sort((a, b) => b[1].hikes - a[1].hikes || a[1].last.localeCompare(b[1].last))[0];
    let hiker: Spotlight["hiker"] = null;
    if (best) {
      const { data: p } = await db.from("profiles").select("first_name, last_name, photo_url, role, status").eq("id", best[0]).maybeSingle();
      const profile = p as { first_name: string | null; last_name: string | null; photo_url: string | null; role: string; status: string } | null;
      if (profile?.role === "individual" && profile.status === "active" && profile.first_name) {
        const initial = profile.last_name?.trim().charAt(0);
        hiker = { name: `${profile.first_name}${initial ? ` ${initial}.` : ""}`, photo: profile.photo_url, hikes: best[1].hikes };
      }
    }

    /* ----------------------------------------------------------------- club */
    const perClub = new Map<string, { hikes: number; regions: Set<string>; people: number }>();
    for (const x of tours) {
      if (x.date < monthStart) continue;
      const c = perClub.get(x.club_id) ?? { hikes: 0, regions: new Set<string>(), people: 0 };
      c.hikes++;
      x.regions.forEach((r) => c.regions.add(r));
      perClub.set(x.club_id, c);
    }
    for (const b of bookings) {
      const x = tourById.get(b.tour_id)!;
      if (x.date >= monthStart) perClub.get(x.club_id)!.people++;
    }
    let club: Spotlight["club"] = null;
    if (perClub.size > 0) {
      const ids = [...perClub.keys()];
      const [{ data: clubRows }, { data: ratingRows }] = await Promise.all([
        db.from("clubs").select("id, name, slug, photo_url").in("id", ids).eq("owner_blocked", false), // a blocked club is not shown
        db.from("ratings").select("club_id, score, comment, created_at").in("club_id", ids),
      ]);
      const ratings = (ratingRows ?? []) as { club_id: string; score: number; comment: string | null; created_at: string }[];
      const scored = ((clubRows ?? []) as { id: string; name: string; slug: string | null; photo_url: string | null }[])
        .map((c) => {
          const s = perClub.get(c.id)!;
          const own = ratings.filter((r) => r.club_id === c.id);
          const rating = (RATING_PRIOR * RATING_PRIOR_VOTES + own.reduce((sum, r) => sum + Number(r.score), 0)) / (RATING_PRIOR_VOTES + own.length);
          const comments = own.filter((r) => r.comment?.trim() && r.created_at.slice(0, 10) >= monthStart).length;
          const activity = 0.7 * part(s.hikes, 8) + 0.3 * part(s.regions.size, 5);
          const satisfaction = 0.8 * (rating / 5) + 0.2 * part(comments, 10);
          const score = 0.4 * activity + 0.35 * satisfaction + 0.25 * part(s.people, 60);
          return { c, s, score };
        })
        .sort((a, b) => b.score - a.score || b.s.people - a.s.people);
      const top = scored[0];
      if (top) club = { name: top.c.name, photo: top.c.photo_url, href: `/clubs/${top.c.slug ?? top.c.id}`, hikes: top.s.hikes, people: top.s.people };
    }

    return { hiker, club };
  } catch {
    return { hiker: null, club: null };
  }
});
