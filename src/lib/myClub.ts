import { createClient } from "@/lib/supabase/server";
import type { Club } from "@/types/database";
import { activePackage, type PackageId } from "@/lib/catalog";
import { getPlans } from "@/lib/plans/server";
import { clubConfig, type PlanConfig } from "@/lib/plans/registry";

export type ClubLimits = {
  pkg: PackageId | null;
  used: number; // upcoming active + hidden tours (what counts toward the cap)
  maxListings: number;
  maxPerTour: number;
  planName: string; // "" without an active plan
  config: PlanConfig; // everything the club may do: its plan plus its own changes
};

// The signed-in club's own row and its current package limits (server only).
// /dashboard is guarded by the middleware, so a missing club is a real error.
export async function getMyClub(): Promise<{ club: Club; limits: ClubLimits } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: club } = await supabase.from("clubs").select("*").eq("owner_id", user.id).single();
  if (!club) return null;

  const { count } = await supabase
    .from("tours")
    .select("id", { count: "exact", head: true })
    .eq("club_id", (club as Club).id)
    .in("status", ["active", "hidden"])
    .gte("date", new Date().toISOString().slice(0, 10));

  const pkg = activePackage(club as Club);
  const plans = await getPlans();
  const plan = pkg ? plans[pkg] : null;
  const config = clubConfig(plans, club as Club);
  return {
    club: club as Club,
    limits: {
      pkg,
      used: count ?? 0,
      maxListings: config.max_active_tours,
      maxPerTour: config.max_participants_per_tour,
      planName: plan?.name ?? "",
      config,
    },
  };
}
