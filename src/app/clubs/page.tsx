import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ClubCard from "@/components/ClubCard";
import type { Club, Rating } from "@/types/database";
import { PACKAGES, activePackage } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Ակումբներ | Highland",
};

export default async function ClubsPage() {
  const supabase = await createClient();
  const { data: clubs } = await supabase.from("clubs").select("*").order("name");
  const { data: ratings } = await supabase.from("ratings").select("club_id, score").not("club_id", "is", null);

  const list = (clubs ?? []) as Club[];
  const ratingRows = (ratings ?? []) as Pick<Rating, "club_id" | "score">[];

  function ratingFor(clubId: string) {
    const scores = ratingRows.filter((r) => r.club_id === clubId).map((r) => r.score);
    if (scores.length === 0) return { rating: null, count: 0 };
    return { rating: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length };
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-center font-serif text-3xl font-semibold text-pine sm:text-4xl">Ակումբներ</h1>
      <p className="mx-auto mt-2 max-w-xl text-center text-neutral-500">
        Հայաստանի արշավական ակումբները, նրանց ուղղվածությունն ու փորձը։
      </p>

      {list.length === 0 ? (
        <p className="mt-10 text-center text-neutral-500">Դեռ ակումբ չկա հարթակում։</p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((club) => {
            const { rating, count } = ratingFor(club.id);
            const pkg = activePackage(club);
            const showRating = !!pkg && PACKAGES[pkg].showsRatings;
            return (
              <ClubCard key={club.id} club={club} showRating={showRating} rating={rating} ratingCount={count} />
            );
          })}
        </div>
      )}
    </main>
  );
}
