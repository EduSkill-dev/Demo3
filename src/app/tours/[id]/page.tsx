import type { Metadata } from "next";
import { cache } from "react";
import { dateWords, dayAndMonth, dayInWords } from "@/lib/calendar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activePackage, formatAmd } from "@/lib/catalog";
import { planConfigOf } from "@/lib/plans/server";
import { getFormatDate, getT } from "@/i18n/server";
import { getSightNames } from "@/lib/sights";
import { getLikeCounts } from "@/lib/likes";
import type { Club, Tour } from "@/types/database";
import BackLink from "@/components/BackLink";
import TourDetails from "@/components/tour/TourDetails";
import TourSignup from "@/components/TourSignup";
import AddToCalendar from "@/components/calendar/AddToCalendar";
import TourShareRow from "@/components/tour/TourShareRow";
import StickyBookBar from "@/components/tour/StickyBookBar";
import { getViewer } from "@/lib/viewer";

import { getShareNetworks } from "@/lib/siteSettings";
import RatingBox from "@/components/RatingBox";

type TourWithClub = Tour & { clubs: Club | null };

// Read once per request: the page and its metadata share it.
const getTour = cache(async (id: string): Promise<TourWithClub | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("tours").select("*, clubs(*)").eq("id", id).maybeSingle();
  return (data as TourWithClub | null) ?? null;
});

// The link preview: the hike's name, "date · regions · club", and its first
// photo (else the Culmen card from the root layout).
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const tour = await getTour(params.id);
  if (!tour) return { title: { absolute: "Culmen" } };
  const t = await getT();
  const words = dateWords(t);
  const when = tour.end_date && tour.end_date > tour.date ? `${dayAndMonth(tour.date, words)} – ${dayAndMonth(tour.end_date, words)}` : dayInWords(tour.date, words);
  const line = [when, tour.regions.map((r) => t(`region.${r}`)).join(", "), tour.clubs?.name].filter(Boolean).join(" · ");
  const photo = tour.photo_urls?.[0];
  return {
    title: tour.title,
    description: line,
    openGraph: { type: "website", siteName: "Culmen", title: tour.title, description: line, url: `/tours/${tour.id}`, ...(photo ? { images: [{ url: photo, alt: tour.title }] } : {}) },
  };
}

// The shareable page of one hike: full details, sign-up and its reviews.
export default async function TourDetailPage({ params }: { params: { id: string } }) {
  const [tour, t, fmt] = await Promise.all([getTour(params.id), getT(), getFormatDate()]);

  if (!tour) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold text-heading">{t("toursPage.empty")}</h1>
        <Link href="/tours" className="mt-6 inline-block rounded-full bg-spruce-500 px-5 py-3 font-semibold text-white">
          {t("home.allTours")}
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const sightNames = await getSightNames();
  const likes = await getLikeCounts([tour.id]);
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
  const plan = await planConfigOf(club);
  // Closed (cap 0) when the tour is not active, an admin took it down or
  // switched the club's applications off, or the club's package lapsed.
  const cap = pkg && tour.status === "active" && !tour.admin_hidden && !club?.applications_blocked ? Math.min(tour.max_participants, plan.max_participants_per_tour) : 0;
  const showReviews = plan.public_show_comments;
  const reviews = ((reviewRows ?? []) as {
    id: string;
    score: number;
    comment: string | null;
    created_at: string;
    author_deleted: boolean;
    author_first_name: string | null;
    author_last_initial: string | null;
  }[]).filter((r) => r.comment?.trim());
  const day = (iso: string) => fmt(iso, "long");
  // Phones get a bar with the price and "Book" while seats are open.
  const viewer = await getViewer();
  const bookable = cap > 0 && taken < cap && tour.date >= new Date().toISOString().slice(0, 10) && viewer?.role !== "club" && viewer?.role !== "admin";

  return (
    <main className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 ${bookable ? "max-lg:pb-24" : ""}`}>
      {bookable && <StickyBookBar price={Number(tour.price) > 0 ? t("common.perPerson", { price: formatAmd(Number(tour.price)) }) : t("common.free")} label={t("signup.book")} />}
      <BackLink fallback="/tours" label={t("clubPage.back")} />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          <TourDetails tour={{ ...tour, likes: likes.tours.get(tour.id) ?? 0, club: club ? { id: club.id, name: club.name } : null, sights: (tour.sight_ids ?? []).flatMap((id) => (sightNames.has(id) ? [{ id, name: sightNames.get(id)! }] : [])) }} seats={cap ? { taken, cap } : undefined} showPageLink={false} />

          {/* The rating form shows only to someone who may rate; an empty box is hidden, and so is the whole part when there is nothing in it. */}
          <section className={showReviews ? "" : "[&:has(>div:empty)]:hidden"}>
            <h2 className="font-serif text-xl font-semibold text-heading">
              {t("clubPage.comments")} <span className="font-sans text-sm font-normal text-muted">({t("tour.commentsOnlyAfter")})</span>
            </h2>
            <div className="mt-4 rounded-xl border border-line bg-surface p-5 empty:hidden">
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
                      <p className="text-terracotta-500">{"★".repeat(r.score)}<span className="text-line">{"★".repeat(5 - r.score)}</span></p>
                      <p className="mt-1 whitespace-pre-line leading-6 text-ink">{r.comment}</p>
                    </li>
                  ))}
                </ul>
              ))}
          </section>
        </div>

        <aside id="signup" className="h-fit scroll-mt-24 lg:sticky lg:top-24">
          <TourSignup
            tourId={tour.id}
            clubId={tour.club_id}
            cancelHours={tour.cancel_hours}
            date={tour.date}
            taken={taken}
            limit={cap}
            total={tour.max_participants}
            meetingTime={tour.meeting_time}
            price={Number(tour.price) || 0}
          />
          {/* Share on Facebook / Instagram (those the admins switched on and
              did not close for this club), then "My calendar". Not for a hike
              that is over. */}
          {tour.date >= new Date().toISOString().slice(0, 10) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <TourShareRow
                path={`/tours/${tour.id}`}
                text={`${tour.title} · ${club?.name ?? ""}`}
                card={{
                  title: tour.title,
                  when: tour.end_date && tour.end_date > tour.date ? `${dayAndMonth(tour.date, dateWords(t))} – ${dayAndMonth(tour.end_date, dateWords(t))}` : dayInWords(tour.date, dateWords(t)),
                  place: tour.regions.map((r) => t(`region.${r}`)).join(", "),
                  club: club?.name ?? "",
                  photo: tour.photo_urls?.[0] ?? null,
                  organiserLabel: t("tour.organiser"),
                  signUpLabel: t("share.signUp"),
                }}
                nets={(await getShareNetworks()).filter((n): n is "facebook" | "instagram" => (n === "facebook" || n === "instagram") && !(club?.share_blocked ?? []).includes(n))}
              />
              <AddToCalendar
                tour={{ id: tour.id, title: tour.title, date: tour.date, end_date: tour.end_date ?? null, place: tour.regions.map((r) => t(`region.${r}`)).join(", "), club: club?.name ?? "" }}
                className="flex h-10 items-center gap-2 rounded-full border-2 border-line px-3.5 text-xs font-semibold text-ink hover:border-spruce-500"
              />
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
