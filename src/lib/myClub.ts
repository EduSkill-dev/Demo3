import { createClient } from "@/lib/supabase/server";
import type { Club } from "@/types/database";
import { PACKAGES, activePackage, type PackageId } from "@/lib/catalog";

export type ClubLimits = {
  pkg: PackageId | null;
  used: number; // upcoming active + hidden tours (what counts toward the cap)
  maxListings: number;
  maxPerTour: number;
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
  return {
    club: club as Club,
    limits: {
      pkg,
      used: count ?? 0,
      maxListings: pkg ? PACKAGES[pkg].maxListings : 0,
      maxPerTour: pkg ? PACKAGES[pkg].maxPerTour : 0,
    },
  };
}
