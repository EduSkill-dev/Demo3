import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicTours } from "@/lib/publicTours";
import { PACKAGES, activePackage } from "@/lib/catalog";
import { getFormatDate, getT } from "@/i18n/server";
import type { Club, ClubGuide } from "@/types/database";
import BackLink from "@/components/BackLink";
import FavoriteToggle from "@/components/FavoriteToggle";
import RatingBox from "@/components/RatingBox";
import TourGrid from "@/components/tour/TourGrid";

type Review = {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  tour_id: string | null;
  tour_title: string | null;
  author_deleted: boolean;
  author_first_name: string | null;
  author_last_initial: string | null;
  author_photo_url: string | null;
};

async function getClub(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clubs").select("*").eq("id", id).maybeSingle();
  return data as Club | null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const club = await getClub(params.id);
  return { title: club ? club.name : { absolute: "Culmen" } };
}

export default async function ClubDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { back?: string };
}) {
  const club = await getClub(params.id);
  if (!club) notFound();

  const [t, fmt] = await Promise.all([getT(), getFormatDate()]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === club.owner_id;

  const [{ data: guides }, { data: reviewRows }, { data: summary }, tours] = await Promise.all([
    supabase.from("club_guides").select("*").eq("club_id", club.id).order("created_at"),
    supabase
      .from("public_reviews")
      .select("id, score, comment, created_at, tour_id, tour_title, author_deleted, author_first_name, author_last_initial, author_photo_url")
      .eq("club_id", club.id)
      .order("created_at", { ascending: false }),
    supabase.from("club_rating_summary").select("average, count").eq("club_id", club.id).maybeSingle(),
    getPublicTours({ clubId: club.id }),
  ]);

  // The package decides whether visitors see the rating and reviews; the club
  // itself always sees them (with a note when they are hidden).
  const pkg = activePackage(club);
  const publicRatings = !!pkg && PACKAGES[pkg].showsRatings;
  const showReviews = publicRatings || isOwner;
  const reviews = ((reviewRows ?? []) as Review[]).filter((r) => r.comment?.trim());
  const rating = summary as { average: number; count: number } | null;

  // Only same-site paths are honoured as "Back" targets.
  const back = searchParams.back && searchParams.back.startsWith("/") && !searchParams.back.startsWith("//") ? searchParams.back : null;
  const day = (iso: string) => fmt(iso, "long");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <BackLink href={back} fallback="/clubs" label={t("clubPage.back")} />

      <section className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-line bg-sand">
          {club.photo_url ? (
            <img src={club.photo_url} alt={club.name} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl">🏔️</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-3xl font-semibold text-heading">{club.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {showReviews && rating && (
              <span className="font-semibold text-terracotta-500">
                ★ {Number(rating.average).toFixed(1)}/5 <span className="font-normal text-muted">· {t("clubsPage.reviews", { count: rating.count })}</span>
              </span>
            )}
            {club.phone && (
              <a href={`tel:${club.phone.replace(/\s/g, "")}`} className="text-ink hover:text-terracotta-700">📞 {club.phone}</a>
            )}
          </div>
        </div>
        <FavoriteToggle clubId={club.id} />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-10">
          {club.description && (
            <section>
              <h2 className="font-serif text-xl font-semibold text-heading">{t("clubPage.about")}</h2>
              <p className="mt-3 whitespace-pre-line leading-7 text-ink">{club.description}</p>
            </section>
          )}

          {(guides ?? []).length > 0 && (
            <section>
              <h2 className="font-serif text-xl font-semibold text-heading">{t("clubPage.guides")}</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {((guides ?? []) as ClubGuide[]).map((g) => (
                  <li key={g.id} className="flex flex-col items-center rounded-2xl border border-line bg-surface p-5 text-center shadow-sm">
                    <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-sand bg-sand">
                      {g.photo_url ? (
                        <img src={g.photo_url} alt={[g.first_name, g.last_name].filter(Boolean).join(" ")} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl">🧭</div>
                      )}
                    </div>
                    <p className="mt-3 font-serif text-lg font-semibold text-heading">
                      {[g.first_name, g.last_name].filter(Boolean).join(" ")}
                    </p>
                    {g.role && <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-500">{g.role}</p>}
                    {g.bio && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">{g.bio}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="font-serif text-xl font-semibold text-heading">{t("clubPage.upcomingTours")}</h2>
            <div className="mt-4">
              {tours.length === 0 ? <p className="text-muted">{t("clubPage.noTours")}</p> : <TourGrid tours={tours} columns="sm:grid-cols-2" />}
            </div>
          </section>

          <section id="comments">
            <h2 className="font-serif text-xl font-semibold text-heading">{t("clubPage.comments")}</h2>
            {isOwner && !publicRatings && (
              <p className="mt-3 rounded-lg border border-terracotta-500/40 bg-terracotta-500/10 p-3 text-sm text-ink">
                {t("clubPage.hiddenForPackage")}{" "}
                <Link href="/dashboard/packages" className="font-semibold text-terracotta-700 underline dark:text-terracotta-300">
                  {t("clubPage.upgrade")}
                </Link>
              </p>
            )}
            {!isOwner && (
              <div className="mt-4 rounded-xl border border-line bg-surface p-5">
                <RatingBox target="club" clubId={club.id} noun={club.name} />
              </div>
            )}
            {showReviews &&
              (reviews.length === 0 ? (
                <p className="mt-4 text-muted">{t("clubPage.noComments")}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {reviews.map((r) => {
                    const name = r.author_deleted
                      ? t("account.deletedUser")
                      : [r.author_first_name, r.author_last_initial ? `${r.author_last_initial}.` : ""].filter(Boolean).join(" ");
                    return (
                      <li key={r.id} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-sand">
                          {r.author_photo_url ? (
                            <img src={r.author_photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-semibold text-muted">
                              {(name || "?").slice(0, 1)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-semibold text-ink">{name}</p>
                            <p className="text-xs text-muted">{day(r.created_at)}</p>
                          </div>
                          <p className="text-sm text-terracotta-500" aria-label={`${r.score}/5`}>
                            {"★".repeat(r.score)}
                            <span className="text-line">{"★".repeat(5 - r.score)}</span>
                            {r.tour_title && <span className="ml-2 text-xs text-muted">{t("clubPage.onTour", { title: r.tour_title })}</span>}
                          </p>
                          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink">{r.comment}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </section>
        </div>

        <aside className="space-y-8">
          {club.focus?.length > 0 && (
            <section>
              <h2 className="font-serif text-lg font-semibold text-heading">{t("clubPage.focus")}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {club.focus.map((f) => (
                  <span key={f} className="rounded-full bg-sand px-3 py-1 text-sm text-ink">{t(`focus.${f}`)}</span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
