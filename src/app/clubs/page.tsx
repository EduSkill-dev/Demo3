import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublicTours } from "@/lib/publicTours";
import { PACKAGES, activePackage } from "@/lib/catalog";
import { getT } from "@/i18n/server";
import ClubCard from "@/components/ClubCard";
import type { Club } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getT())("clubsPage.title")} | Highland` };
}

export default async function ClubsPage() {
  const t = await getT();
  const supabase = await createClient();
  const [{ data: clubs }, { data: ratings }, tours] = await Promise.all([
    supabase.from("clubs").select("*").order("name"),
    supabase.from("club_rating_summary").select("club_id, average, count"),
    getPublicTours(),
  ]);

  const list = (clubs ?? []) as Club[];
  const ratingOf = new Map(((ratings ?? []) as { club_id: string; average: number; count: number }[]).map((r) => [r.club_id, r]));
  const upcoming = new Map<string, number>();
  for (const tour of tours) upcoming.set(tour.club_id, (upcoming.get(tour.club_id) ?? 0) + 1);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-center font-serif text-3xl font-semibold text-heading sm:text-4xl">{t("clubsPage.title")}</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted">{t("clubsPage.intro")}</p>

      {list.length === 0 ? (
        <p className="mt-10 text-center text-muted">{t("clubsPage.empty")}</p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((club) => {
            const pkg = activePackage(club);
            const r = ratingOf.get(club.id);
            const rating = pkg && PACKAGES[pkg].showsRatings && r ? { average: Number(r.average), count: r.count } : null;
            return <ClubCard key={club.id} club={club} rating={rating} upcoming={upcoming.get(club.id) ?? 0} t={t} />;
          })}
        </div>
      )}
    </main>
  );
}
