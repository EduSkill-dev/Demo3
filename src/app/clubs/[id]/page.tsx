import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TARIFF_LIMITS, parseFocusAreas, type Club, type ClubGuide, type Rating, type Tariff } from "@/types/database";
import FavoriteToggle from "@/components/FavoriteToggle";
import RatingBox from "@/components/RatingBox";

export default async function ClubDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: club } = await supabase.from("clubs").select("*").eq("id", params.id).single();
  if (!club) notFound();
  const c = club as Club;

  const showRating = TARIFF_LIMITS[c.tariff as Tariff].showRatings;

  const { data: ratingRows } = showRating
    ? await supabase
        .from("ratings")
        .select("*")
        .eq("club_id", c.id)
        .order("created_at", { ascending: false })
    : { data: [] as Rating[] };

  const ratings = (ratingRows ?? []) as Rating[];
  const avg =
    ratings.length > 0 ? ratings.reduce((a, r) => a + r.score, 0) / ratings.length : null;

  const { data: guideRows } = await supabase
    .from("club_guides")
    .select("*")
    .eq("club_id", c.id)
    .order("created_at", { ascending: true });
  const guides = (guideRows ?? []) as ClubGuide[];
  const focusTags = parseFocusAreas(c.focus_areas);

  return (
    <main>
      <section className="relative">
        {c.photo_url ? (
          <img src={c.photo_url} alt={c.name} className="h-64 w-full object-cover" />
        ) : (
          <div className="flex h-64 items-center justify-center bg-gradient-to-br from-pine to-apricot/70 text-5xl">
            🏔️
          </div>
        )}
      </section>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-serif text-3xl font-semibold text-pine">{c.name}</h1>
        {showRating && (
          <p className="mt-1 text-sm font-semibold text-apricot">
            {avg != null ? `★ ${avg.toFixed(1)} (${ratings.length})` : "Դեռ գնահատական չկա"}
          </p>
        )}
        <FavoriteToggle clubId={c.id} />

        {c.description && (
          <div className="mt-8">
            <h2 className="font-serif text-lg font-semibold text-pine">Մեր մասին</h2>
            <p className="mt-1 whitespace-pre-line text-neutral-600">{c.description}</p>
          </div>
        )}

        {focusTags.length > 0 && (
          <div className="mt-8">
            <h2 className="font-serif text-lg font-semibold text-pine">Ուղղվածությունը</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {focusTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-sand px-3 py-1 text-sm text-pine"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {guides.length > 0 && (
          <div className="mt-8" id="guides">
            <h2 className="font-serif text-lg font-semibold text-pine">
              Ուղեկցողները ({guides.length})
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {guides.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-3 rounded-xl border border-sand bg-white p-3"
                >
                  {g.photo_url ? (
                    <img
                      src={g.photo_url}
                      alt={`${g.first_name} ${g.last_name}`}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sand text-2xl">
                      🙂
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-neutral-800">
                      {g.first_name} {g.last_name}
                    </p>
                    <p className="text-xs text-neutral-500">Ուղեկցող</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!c.description && focusTags.length === 0 && guides.length === 0 && (
          <p className="mt-6 text-neutral-500">
            Ակումբը դեռ չի լրացրել իր մասին տեղեկություն։ Այն կլրացվի «Ակումբի տվյալներ» բաժնից։
          </p>
        )}

        {showRating && (
          <div id="comments" className="mt-12 border-t border-sand pt-8">
            <h2 className="font-serif text-lg font-semibold text-pine">Մեկնաբանություններ</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Մեկնաբանություն կարող են թողնել միայն այն օգտատերերը, ովքեր
              մասնակցել են այս ակումբի առնվազն մեկ արշավին։
            </p>

            <div className="mt-4 rounded-2xl border border-sand bg-white p-5">
              <RatingBox target="club" clubId={c.id} noun="ակումբը" />
            </div>

            {ratings.filter((r) => r.comment).length === 0 ? (
              <p className="mt-4 text-neutral-500">Դեռ մեկնաբանություն չկա։ Եթե մասնակցել ես, առաջինը գրիր։</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {ratings
                  .filter((r) => r.comment)
                  .map((r) => (
                    <li key={r.id} className="rounded-lg border border-sand p-4 text-sm">
                      <span className="font-semibold text-apricot">★ {r.score}</span>
                      <p className="mt-1 text-neutral-600">{r.comment}</p>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
