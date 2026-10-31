import { createClient } from "@/lib/supabase/server";
import type { Club } from "@/types/database";
import { activePackage, addDaysTo, type PackageId } from "@/lib/catalog";
import { getPlans } from "@/lib/plans/server";
import { clubConfig, type PlanConfig } from "@/lib/plans/registry";
import { getBusinessSettings } from "@/lib/business";
import { addMonths, monthOf, todayInYerevan } from "@/lib/calendar";

export type ClubLimits = {
  pkg: PackageId;
  planName: string;
  config: PlanConfig; // everything the club may do: its plan plus its own changes
  // Listings (the database enforces these, see 0084_business_model.sql).
  running: number; // published and not yet over
  runningMax: number;
  monthMax: number;
  thisMonth: { month: string; published: number };
  nextMonth: { month: string; published: number };
  // No commission until this day (from the club's sign-up).
  promoEndsAt: string | null;
};

// The signed-in club's own row and what it may do now (server only).
// /dashboard is guarded by the middleware, so a missing club is a real error.
export async function getMyClub(): Promise<{ club: Club; limits: ClubLimits } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase.from("clubs").select("*").eq("owner_id", user.id).single();
  if (!row) return null;
  const club = row as Club;

  const today = todayInYerevan();
  const current = monthOf(today);
  const next = addMonths(current, 1);
  const [plans, business, { data: runningRows }, { data: countRows }] = await Promise.all([
    getPlans(),
    getBusinessSettings(),
    supabase.from("tours").select("date, end_date").eq("club_id", club.id).eq("status", "active").gte("date", addDaysToDay(today, -60)),
    supabase.from("club_listing_counts").select("month, published").eq("club_id", club.id).in("month", [`${current}-01`, `${next}-01`]),
  ]);
  const running = ((runningRows ?? []) as { date: string; end_date: string | null }[]).filter((x) => (x.end_date ?? x.date) >= today).length;
  const counts = new Map(((countRows ?? []) as { month: string; published: number }[]).map((x) => [x.month.slice(0, 7), x.published]));
  const pkg = activePackage(club);
  const promoEnds = club.created_at ? addDaysTo(new Date(club.created_at), business.promo_days) : null;
  return {
    club,
    limits: {
      pkg,
      planName: plans[pkg].name,
      config: clubConfig(plans, club),
      running,
      runningMax: business.listing_limit_active,
      monthMax: business.listing_limit_month,
      thisMonth: { month: current, published: counts.get(current) ?? 0 },
      nextMonth: { month: next, published: counts.get(next) ?? 0 },
      promoEndsAt: promoEnds && promoEnds.getTime() > Date.now() ? promoEnds.toISOString() : null,
    },
  };
}

// A multi-day hike is at most 60 days long, so this finds every running one.
const addDaysToDay = (day: string, days: number) => addDaysTo(new Date(`${day}T12:00:00Z`), days).toISOString().slice(0, 10);
