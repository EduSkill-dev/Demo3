import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicTours } from "@/lib/publicTours";
import { planConfigOf } from "@/lib/plans/server";
import { getFormatDate, getT } from "@/i18n/server";
import type { Club, ClubGuide } from "@/types/database";
import BackLink from "@/components/BackLink";
import { SOCIAL_NAMES, SOCIAL_NETS, socialOk } from "@/lib/socialLinks";
import SocialIcon, { SOCIAL_COLOR } from "@/components/club/SocialIcon";
import RatingBox from "@/components/RatingBox";
import TourGrid from "@/components/tour/TourGrid";
import { orderFocus } from "@/lib/catalog";
import TeamCard from "@/components/club/TeamCard";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The address is the club's slug; an old /clubs/<id> link still finds it.
async function getClub(key: string) {
  const supabase = await createClient();
  const byId = UUID.test(key);
  const { data } = await supabase
    .from("clubs")
    .select("*")
    .eq(byId ? "id" : "slug", byId ? key : decodeURIComponent(key).toLowerCase())
    .maybeSingle();
  return data as Club | null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const club = await getClub(params.id);
  return { title: club ? club.name : { absolute: "Culmen" } };
}

export default async function ClubDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { back?: string } }) {
  const club = await getClub(params.id);
  if (!club) notFound();
  const socials = SOCIAL_NETS.map((net) => ({ net, url: club[`${net}_url` as const] ?? "" })).filter((x) => x.url && socialOk(x.net, x.url));
  if (club.slug && params.id !== club.slug) {
    redirect(`/clubs/${club.slug}${searchParams.back ? `?back=${encodeURIComponent(searchParams.back)}` : ""}`);
  }

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
  // The plan decides what visitors see (rating, comments) and whether the
  // club itself gets its comments; the club always sees its own rating.
  const plan = await planConfigOf(club);
  const publicRatings = plan.public_show_rating && plan.public_show_comments; // nothing is hidden from visitors
  const showRating = plan.public_show_rating || isOwner;
  const showReviews = plan.public_show_comments || (isOwner && plan.dashboard_comments_tab);
  const reviews = ((reviewRows ?? []) as Review[]).filter((r) => r.comment?.trim());
  const rating = summary as { average: number; count: number } | null;

  // Only same-site paths are honoured as "Back" targets.
  const back = searchParams.back && searchParams.back.startsWith("/") && !searchParams.back.startsWith("//") ? searchParams.back : null;
  const day = (iso: string) => fmt(iso, "long");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <BackLink href={back} fallback="/clubs" label={t("clubPage.back")} />

      <div className={`mt-6 grid gap-8 ${club.description ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" : ""}`}>
        <div>
          <section className="flex flex-col gap-6 sm:flex-row sm:items-center">
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
                {showRating && rating && (
                  <span className="font-semibold text-terracotta-500">
                    ★ {Number(rating.average).toFixed(1)}/5 <span className="font-normal text-muted">· {t("clubsPage.reviews", { count: rating.count })}</span>
                  </span>
                )}
                {/* The club's own public contacts (not the sign-up number). */}
                {club.contact_phone && (
                  <a href={`tel:${club.contact_phone.replace(/\s/g, "")}`} className="text-ink hover:text-terracotta-700">
                    📞 {club.contact_phone}
                  </a>
                )}
                {club.contact_email && (
                  <a href={`mailto:${club.contact_email}`} className="break-all text-ink hover:text-terracotta-700">
                    ✉️ {club.contact_email}
                  </a>
                )}
                {club.contact_address && <span className="font-semibold text-ink">📍 {club.contact_address}</span>}
              </div>
              {/* The club's own pages on social networks (each checked to be that network). */}
              {socials.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {socials.map(({ net, url }) => (
                    <a
                      key={net}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: SOCIAL_COLOR[net] }}
                    >
                      <SocialIcon net={net} className="h-4 w-4" />
                      {SOCIAL_NAMES[net]}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>
          {club.focus?.length > 0 && (
            <section className="mt-8">
              <h2 className="font-serif text-lg font-semibold text-heading">{t("clubPage.focus")}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {orderFocus(club.focus).map((f) => (
                  <span key={f} className="rounded-full bg-sand px-3 py-1 text-sm text-ink">
                    {t(`focus.${f}`)}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
        {/* About the club, set off by an orange line on wide screens. */}
        {club.description && (
          <section className="lg:border-l-[3px] lg:border-terracotta-500 lg:pl-8">
            <h2 className="font-serif text-xl font-semibold text-heading">{t("clubPage.about")}</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-ink">{club.description}</p>
          </section>
        )}
      </div>

      <div className="mt-12">
        <div className="space-y-10">
          {(guides ?? []).length > 0 && (
            <section>
              <h2 className="font-serif text-xl font-semibold text-heading">{t("clubPage.guides")}</h2>
              <ul className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(13.5rem,1fr))]">
                {((guides ?? []) as ClubGuide[]).map((g) => (
                  <TeamCard key={g.id} name={[g.first_name, g.last_name].filter(Boolean).join(" ")} role={g.role} bio={g.bio} photo={g.photo_url} moreLabel={t("clubPage.teamMore")} />
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="font-serif text-xl font-semibold text-heading">{t("clubPage.upcomingTours")}</h2>
            <div className="mt-4">
              {tours.length === 0 ? <p className="text-muted">{t("clubPage.noTours")}</p> : <TourGrid tours={tours} size="sm" columns="sm:grid-cols-2 lg:grid-cols-3" />}
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
                            <div className="flex h-full w-full items-center justify-center font-semibold text-muted">{(name || "?").slice(0, 1)}</div>
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
      </div>
    </main>
  );
}
