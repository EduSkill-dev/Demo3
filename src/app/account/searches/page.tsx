import { createClient } from "@/lib/supabase/server";
import { getSightOptions } from "@/lib/sights";
import { getT } from "@/i18n/server";
import SavedSearches, { type SavedSearch } from "@/components/account/SavedSearches";

// Up to five saved searches; a new hike that matches any of them arrives as a
// notification (see notify_favorites_on_new_tour in migration 0057).
export default async function AccountSearchesPage({ searchParams }: { searchParams: { sight?: string; club?: string } }) {
  const t = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: rows }, sights, { data: clubRows }] = await Promise.all([
    supabase
      .from("saved_searches")
      .select("id, region, sight_id, terrain, club_id, date_from, date_to, overnight, created_at")
      .eq("user_id", user.id)
      .order("created_at"),
    getSightOptions(),
    supabase.from("clubs").select("id, name").order("name"),
  ]);
  const clubs = (clubRows ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">{t("searches.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("searches.intro")}</p>
        <p className="mt-1 text-sm text-muted">{t("searches.clubHint")}</p>
      </div>
      <SavedSearches
        userId={user.id}
        searches={(rows ?? []) as SavedSearch[]}
        sights={sights}
        clubs={clubs}
        prefill={{
          sight: sights.some((s) => s.id === searchParams.sight) ? searchParams.sight! : "",
          club: clubs.some((c) => c.id === searchParams.club) ? searchParams.club! : "",
        }}
      />
    </div>
  );
}
