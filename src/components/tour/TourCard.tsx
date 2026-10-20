"use client";

import Link from "next/link";
import { formatAmd } from "@/lib/catalog";
import { useFormatDate, useT } from "@/i18n/client";
import type { PublicTour } from "@/lib/publicTours";
import LikeButton from "@/components/LikeButton";
import CardPhotos from "@/components/tour/CardPhotos";
import CertifiedBadge from "@/components/club/CertifiedBadge";

// Difficulty chips: easy = Spruce, hard = Terracotta, the rest neutral.
const DIFFICULTY_CHIP: Record<string, string> = {
  easy: "bg-spruce-100 text-spruce-700",
  hard: "bg-terracotta-100 text-terracotta-700",
};
const NEUTRAL_CHIP = "bg-sand text-[#5A4A2E] dark:text-ink";
const chip = "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold leading-none";
const icon = "h-4 w-4 shrink-0 text-spruce-500 dark:text-spruce-300";

// One hike on the Tours page / home page: photo · title · date and regions on
// one line (click a region = filter) · chips · club, its rating and the price ·
// See more.
export default function TourCard({
  tour,
  backHref,
  onRegion,
  onOpen,
  size = "md",
}: {
  tour: PublicTour;
  backHref?: string; // where the club page's "Back" should return to
  onRegion?: (region: string) => void;
  onOpen: () => void;
  size?: "md" | "sm"; // "sm": three in a row, smaller text (Tours page, calendar)
}) {
  const t = useT();
  const fmt = useFormatDate();
  const closed = tour.cap <= 0;
  const full = tour.taken >= tour.cap;
  const date = fmt(tour.date, "weekdayShort");
  const ended = tour.date < new Date().toISOString().slice(0, 10);
  const sm = size === "sm";
  // Seats still free right now (not shown once the hike is full or over).
  const free = !ended && !full ? Math.max(0, tour.cap - tour.taken) : 0;
  const clubHref = `/clubs/${tour.club.id}${backHref ? `?back=${encodeURIComponent(backHref)}` : ""}`;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-terracotta-300/70 hover:shadow-lg">
      <div className="relative">
        <CardPhotos photos={tour.photo_urls ?? []} title={tour.title} className="h-52" onOpen={onOpen} />
        {ended ? (
          <span className="absolute left-3 top-3 rounded-full bg-spruce-900 px-2.5 py-1 text-xs font-semibold text-white">{t("calendar.ended")}</span>
        ) : full ? (
          <span className="absolute left-3 top-3 rounded-full bg-terracotta-500 px-2.5 py-1 text-xs font-semibold text-white">
            {closed ? t("signup.closed") : t("toursPage.full")}
          </span>
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col ${sm ? "p-4" : "p-5"}`}>
        <h3 className={`${sm ? "text-[17px]" : "text-[21px]"} font-bold leading-snug text-heading`}>
          <Link href={`/tours/${tour.id}`} className="hover:text-terracotta-700 hover:underline dark:hover:text-terracotta-300">{tour.title}</Link>
        </h3>

        {/* Date, regions and free seats on one line (they wrap when long). */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink">
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            {date}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span className="flex flex-wrap gap-x-1">
              {tour.regions.map((r, i) => (
                <span key={r}>
                  {onRegion ? (
                    <button
                      data-view
                      type="button"
                      onClick={() => onRegion(r)}
                      title={t("toursPage.filterByRegion", { region: t(`region.${r}`) })}
                      className="font-medium hover:text-terracotta-700 hover:underline"
                    >
                      {t(`region.${r}`)}
                    </button>
                  ) : (
                    <span className="font-medium">{t(`region.${r}`)}</span>
                  )}
                  {i < tour.regions.length - 1 && ","}
                </span>
              ))}
            </span>
          </span>
          {free > 0 && (
            <span className="flex items-center gap-1.5 font-semibold text-spruce-700 dark:text-spruce-300">
              <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
              </svg>
              {t("tour.seatsFree", { count: free })}
            </span>
          )}
        </div>

        {/* The chips wrap; the like stays on the right of their first line. */}
        <div className="mt-2.5 flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            <span className={`${chip} ${DIFFICULTY_CHIP[tour.difficulty] ?? NEUTRAL_CHIP}`}>{t(`difficulty.${tour.difficulty}`)}</span>
            {tour.overnight && <span className={`${chip} bg-apricot-100 text-apricot-700`}>🌙 {t("common.overnight")}</span>}
            <span className={`${chip} ${NEUTRAL_CHIP}`}>{t("common.upTo", { count: tour.max_participants })}</span>
          </div>
          <span className="flex h-6 shrink-0 items-center">
            <LikeButton kind="tour" id={tour.id} count={tour.likes} />
          </span>
        </div>

        <div className="mt-auto pt-3">
          {/* The club, its rating (when its plan shows it) and the price. */}
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="flex min-w-0 items-center gap-1">
                <Link href={clubHref} className="truncate text-[15px] font-semibold text-heading hover:text-terracotta-700">
                  {tour.club.name}
                </Link>
                {tour.club.certified && <CertifiedBadge clubHref={`/clubs/${tour.club.id}`} />}
              </span>
              {tour.club.rating && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted" title={t("tour.ratingTitle", { count: tour.club.rating.count })}>
                  <span className="-mt-px text-[15px] leading-none text-apricot-500">★</span>
                  <span className="font-semibold text-ink">{tour.club.rating.average.toFixed(1)}/5</span>
                  <span className="inline-flex items-center">
                    (
                    <svg viewBox="0 0 24 24" className="mr-0.5 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="9" cy="8" r="3.5" />
                      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
                    </svg>
                    {tour.club.rating.count})
                  </span>
                </span>
              )}
            </p>
            <p className="shrink-0 whitespace-nowrap font-bold text-terracotta-700 dark:text-terracotta-300">
              {Number(tour.price) > 0 ? t("common.perPerson", { price: formatAmd(tour.price) }) : t("common.free")}
            </p>
          </div>
          <button
            data-view
            type="button"
            onClick={onOpen}
            className="mt-3 w-full rounded-lg bg-spruce-500 px-4 py-2.5 text-sm font-semibold text-card hover:bg-spruce-900"
          >
            {t("toursPage.seeMore")}
          </button>
        </div>
      </div>
    </article>
  );
}
