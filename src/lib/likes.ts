// Server-only: thumbs-up counts for hike cards and pages (view from 0037).
import { createClient } from "@/lib/supabase/server";

export type LikeCounts = { tours: Map<string, number> };

// One query, only for the hikes on the page.
export async function getLikeCounts(tourIds: string[]): Promise<LikeCounts> {
  const supabase = await createClient();
  const { data: tours } = await (tourIds.length ? supabase.from("tour_like_counts").select("tour_id, likes").in("tour_id", tourIds) : Promise.resolve({ data: [] }));
  return {
    tours: new Map(((tours ?? []) as { tour_id: string; likes: number }[]).map((r) => [r.tour_id, r.likes])),
  };
}
