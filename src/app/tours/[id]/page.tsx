import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PACKAGES, activePackage } from "@/lib/catalog";
import { getLocale, getT } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import type { Club, Tour } from "@/types/database";
import BackLink from "@/components/BackLink";
import TourDetails from "@/components/tour/TourDetails";
import TourSignup from "@/components/TourSignup";
import RatingBox from "@/components/RatingBox";

type TourWithClub = Tour & { clubs: Club | null };

async function getTour(id: string): Promise<TourWithClub | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("tours").select("*, clubs(*)").eq("id", id).maybeSingle();
  return (data as TourWithClub | null) ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const tour = await getTour(params.id);
  if (!tour) return { title: "Highland" };
  return { title: `${tour.title} | Highland`, description: tour.description ?? tour.title };
}

// The shareable page of one hike: full details, sign-up and its reviews.
export default async function TourDetailPage({ params }: { params: { id: string } }) {
  const [tour, t, locale] = await Promise.all([getTour(params.id), getT(), getLocale()]);

  if (!tour) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold text-heading">{t("toursPage.empty")}</h1>
        <Link href="/tours" className="mt-6 inline-block rounded-lg bg-apricot px-5 py-3 font-semibold text-white">
          {t("home.allTours")}
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: takenRaw }, { data: reviewRows }] = await Promise.all([
    supabase.rpc("seats_taken", { p_tour: tour.id }),
    supabase
      .from("public_reviews")
      .select("id, score, comment, created_at, author_deleted, author_first_name, author_last_initial")
      .eq("tour_id", tour.id)
      .order("created_at", { ascending: false }),
  ]);
  const taken = typeof takenRaw === "number" ? takenRaw : 0;

  const club = tour.clubs;
  const pkg = activePackage(club);
  // Closed (cap 0) when the tour is not active or the club's package lapsed.
  const cap = pkg && tour.status === "active" ? Math.min(tour.max_participants, PACKAGES[pkg].maxPerTour) : 0;
  const showReviews = !!pkg && PACKAGES[pkg].showsRatings;
  const reviews = ((reviewRows ?? []) as {
    id: string;
    score: number;
    comment: string | null;
    created_at: string;
    author_deleted: boolean;
    author_first_name: string | null;
    author_last_initial: string | null;
  }[]).filter((r) => r.comment?.trim());
  const day = (iso: string) => new Date(iso).toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <BackLink fallback="/tours" label={t("clubPage.back")} />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          <TourDetails tour={{ ...tour, club: club ? { id: club.id, name: club.name } : null }} seats={cap ? { taken, cap } : undefined} showPageLink={false} />

          <section>
            <h2 className="font-serif text-xl font-semibold text-heading">{t("clubPage.comments")}</h2>
            <div className="mt-4 rounded-xl border border-line bg-surface p-5">
              <RatingBox target="tour" tourId={tour.id} noun={tour.title} />
            </div>
            {showReviews &&
              (reviews.length === 0 ? (
                <p className="mt-4 text-muted">{t("clubPage.noComments")}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {reviews.map((r) => (
                    <li key={r.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold text-ink">
                          {r.author_deleted
                            ? t("account.deletedUser")
                            : [r.author_first_name, r.author_last_initial ? `${r.author_last_initial}.` : ""].filter(Boolean).join(" ")}
                        </span>
                        <span className="text-xs text-muted">{day(r.created_at)}</span>
                      </div>
                      <p className="text-apricot">{"★".repeat(r.score)}<span className="text-line">{"★".repeat(5 - r.score)}</span></p>
                      <p className="mt-1 whitespace-pre-line leading-6 text-ink">{r.comment}</p>
                    </li>
                  ))}
                </ul>
              ))}
          </section>
        </div>

        <aside className="h-fit lg:sticky lg:top-24">
          <TourSignup
            tourId={tour.id}
            date={tour.date}
            taken={taken}
            limit={cap}
            meetingTime={tour.meeting_time}
            price={Number(tour.price) || 0}
          />
        </aside>
      </div>
    </main>
  );
}
