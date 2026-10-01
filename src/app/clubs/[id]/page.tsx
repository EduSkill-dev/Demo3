import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TARIFF_LIMITS, type Club, type Rating, type Tariff } from "@/types/database";
import FavoriteToggle from "@/components/FavoriteToggle";

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

  const aboutSections = [
    { title: "Մեր մասին", text: c.description },
    { title: "Թիմը", text: c.team_info },
    { title: "Ուղեկցողները", text: c.guides_info },
    { title: "Ուղղվածությունը", text: c.focus_areas },
  ].filter((s) => s.text);

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

        {aboutSections.length === 0 ? (
          <p className="mt-6 text-neutral-500">
            Ակումբը դեռ չի լրացրել իր մասին տեղեկություն։
          </p>
        ) : (
          <div className="mt-8 space-y-6">
            {aboutSections.map((s) => (
              <div key={s.title}>
                <h2 className="font-serif text-lg font-semibold text-pine">{s.title}</h2>
                <p className="mt-1 whitespace-pre-line text-neutral-600">{s.text}</p>
              </div>
            ))}
          </div>
        )}

        {showRating && (
          <div id="comments" className="mt-12 border-t border-sand pt-8">
            <h2 className="font-serif text-lg font-semibold text-pine">Մեկնաբանություններ</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Մեկնաբանություն կարող են թողնել միայն այն օգտատերերը, ովքեր
              մասնակցել են այս ակումբի առնվազն մեկ արշավին։ Այս գործառույթը
              կակտիվանա, երբ արշավներին գրանցումն ավելացվի։
            </p>

            {ratings.filter((r) => r.comment).length === 0 ? (
              <p className="mt-4 text-neutral-500">Դեռ մեկնաբանություն չկա։</p>
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
