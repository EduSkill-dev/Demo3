// Server-only: like counts for cards and pages (views from migration 0037).
import { createClient } from "@/lib/supabase/server";

export type LikeCounts = { tours: Map<string, number>; clubs: Map<string, number> };

// One query per kind, only for the ids on the page.
export async function getLikeCounts(tourIds: string[], clubIds: string[]): Promise<LikeCounts> {
  const supabase = await createClient();
  const [{ data: tours }, { data: clubs }] = await Promise.all([
    tourIds.length ? supabase.from("tour_like_counts").select("tour_id, likes").in("tour_id", tourIds) : Promise.resolve({ data: [] }),
    clubIds.length ? supabase.from("club_like_counts").select("club_id, likes").in("club_id", clubIds) : Promise.resolve({ data: [] }),
  ]);
  return {
    tours: new Map(((tours ?? []) as { tour_id: string; likes: number }[]).map((r) => [r.tour_id, r.likes])),
    clubs: new Map(((clubs ?? []) as { club_id: string; likes: number }[]).map((r) => [r.club_id, r.likes])),
  };
}
