// Server-only: one club's numbers for one calendar month.
//
// A hike belongs to the month of its (first) day. Cancelled hikes are left
// out. A sign-up counts as income when it stayed confirmed — including
// people who did not cancel in time and did not come; a cancelled sign-up
// does not.
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, addMonths } from "@/lib/calendar";
import type { Difficulty } from "@/types/database";

export const REPORT_SOURCES = ["culmen", "facebook", "instagram", "whatsapp", "viber", "telegram", "link"] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];
export type SourceCounts = Record<ReportSource, number>;

export type ReportHike = {
  id: string;
  title: string;
  date: string;
  regions: string[];
  difficulty: Difficulty;
  overnight: boolean;
  price: number;
  booked: number; // confirmed sign-ups
  came: number;
  absent: number;
  cancelled: number;
  sources: SourceCounts;
  revenue: number;
};

export type MonthlyReport = {
  month: string; // YYYY-MM
  hikes: ReportHike[];
  totals: {
    hikes: number;
    overnight: number;
    regions: string[]; // every region named in the month's listings
    booked: number;
    came: number;
    absent: number;
    unmarked: number;
    cancelled: number;
    sources: SourceCounts;
    revenue: number;
    followers: number; // at the end of the month
    newFollowers: number;
    comments: number;
    rating: { average: number; count: number } | null; // as it stood on the month's last day
  };
};

const noSources = (): SourceCounts => Object.fromEntries(REPORT_SOURCES.map((s) => [s, 0])) as SourceCounts;

export async function getMonthlyReport(clubId: string, month: string): Promise<MonthlyReport> {
  const db = createAdminClient();
  const first = `${month}-01`;
  const next = `${addMonths(month, 1)}-01`;
  const last = addDays(next, -1);

  const [{ data: tourRows }, { data: followerRows }, { data: reviewRows }] = await Promise.all([
    db.from("tours").select("id, title, date, regions, difficulty, overnight, price").eq("club_id", clubId).neq("status", "cancelled").gte("date", first).lte("date", last).order("date"),
    db.from("favorite_clubs").select("created_at").eq("club_id", clubId).lt("created_at", next),
    db.from("public_reviews").select("score, comment, created_at").eq("club_id", clubId).lt("created_at", next),
  ]);
  const tours = (tourRows ?? []) as { id: string; title: string; date: string; regions: string[]; difficulty: Difficulty; overnight: boolean; price: number | string | null }[];

  const { data: bookingRows } = tours.length
    ? await db.from("bookings").select("tour_id, status, attended, source").in("tour_id", tours.map((x) => x.id))
    : { data: [] };
  const bookings = (bookingRows ?? []) as { tour_id: string; status: "confirmed" | "cancelled"; attended: boolean | null; source: string | null }[];

  const hikes: ReportHike[] = tours.map((x) => {
    const own = bookings.filter((b) => b.tour_id === x.id);
    const confirmed = own.filter((b) => b.status === "confirmed");
    const sources = noSources();
    for (const b of confirmed) {
      const s = (REPORT_SOURCES as readonly string[]).includes(b.source ?? "") ? (b.source as ReportSource) : "culmen";
      sources[s]++;
    }
    const price = Number(x.price) || 0;
    return {
      id: x.id,
      title: x.title,
      date: x.date,
      regions: x.regions,
      difficulty: x.difficulty,
      overnight: x.overnight,
      price,
      booked: confirmed.length,
      came: confirmed.filter((b) => b.attended === true).length,
      absent: confirmed.filter((b) => b.attended === false).length,
      cancelled: own.filter((b) => b.status === "cancelled").length,
      sources,
      revenue: confirmed.length * price,
    };
  });

  const sum = (pick: (h: ReportHike) => number) => hikes.reduce((n, h) => n + pick(h), 0);
  const sources = noSources();
  for (const h of hikes) for (const s of REPORT_SOURCES) sources[s] += h.sources[s];
  const followers = (followerRows ?? []) as { created_at: string }[];
  const reviews = (reviewRows ?? []) as { score: number; comment: string | null; created_at: string }[];
  const booked = sum((h) => h.booked);
  const came = sum((h) => h.came);
  const absent = sum((h) => h.absent);

  return {
    month,
    hikes,
    totals: {
      hikes: hikes.length,
      overnight: hikes.filter((h) => h.overnight).length,
      regions: [...new Set(hikes.flatMap((h) => h.regions))],
      booked,
      came,
      absent,
      unmarked: booked - came - absent,
      cancelled: sum((h) => h.cancelled),
      sources,
      revenue: sum((h) => h.revenue),
      followers: followers.length,
      newFollowers: followers.filter((f) => f.created_at.slice(0, 10) >= first).length,
      comments: reviews.filter((r) => r.comment?.trim() && r.created_at.slice(0, 10) >= first).length,
      rating: reviews.length ? { average: Math.round((reviews.reduce((n, r) => n + Number(r.score), 0) / reviews.length) * 10) / 10, count: reviews.length } : null,
    },
  };
}
