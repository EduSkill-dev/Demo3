import { createClient } from "@/lib/supabase/server";
import type { TourWithClub } from "@/types/database";
import { activePackage } from "@/lib/catalog";

// Tours the public may see and book: active, not in the past, and run by a
// club whose package has not lapsed (an expired club's tours drop off the
// site until it renews). Soonest first.
export async function getPublicTours(): Promise<TourWithClub[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("tours")
    .select("*, clubs(name, tariff, package_ends_at)")
    .eq("status", "active")
    .gte("date", today)
    .order("date", { ascending: true });

  type Row = TourWithClub & {
    clubs: { name: string; tariff: string | null; package_ends_at: string | null } | null;
  };
  return ((data ?? []) as Row[])
    .filter((t) => activePackage(t.clubs))
    .map(({ clubs, ...t }) => ({ ...t, club_name: clubs?.name ?? "" }));
}
