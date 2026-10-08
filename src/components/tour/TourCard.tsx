"use client";

import Link from "next/link";
import { formatAmd } from "@/lib/catalog";
import { useFormatDate, useT } from "@/i18n/client";
import type { PublicTour } from "@/lib/publicTours";

// Difficulty chips: easy = Spruce, hard = Terracotta, the rest neutral.
const DIFFICULTY_CHIP: Record<string, string> = {
  easy: "bg-spruce-100 text-spruce-700",
  hard: "bg-terracotta-100 text-terracotta-700",
};
const NEUTRAL_CHIP = "bg-sand text-[#5A4A2E] dark:text-ink";
const chip = "rounded-full px-2.5 py-0.5 text-xs font-semibold";
const icon = "h-4 w-4 shrink-0 text-spruce-500 dark:text-spruce-300";

// One hike on the Tours page / home page: photo · title · date and regions
// (click a region = filter) · chips · club row with price · See more.
export default function TourCard({
  tour,
  backHref,
  onRegion,
  onOpen,
}: {
  tour: PublicTour;
  backHref?: string; // where the club page's "Back" should return to
  onRegion?: (region: string) => void;
  onOpen: () => void;
}) {
  const t = useT();
  const fmt = useFormatDate();
  const closed = tour.cap <= 0;
  const full = tour.taken >= tour.cap;
  const date = fmt(tour.date, "weekday");
  const clubHref = `/clubs/${tour.club.id}${backHref ? `?back=${encodeURIComponent(backHref)}` : ""}`;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:shadow-md">
      <button data-view type="button" onClick={onOpen} className="relative block" aria-label={tour.title}>
        {tour.photo_urls?.[0] ? (
          <img src={tour.photo_urls[0]} alt="" className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-48 items-center justify-center bg-gradient-to-br from-spruce-500 to-spruce-300 text-4xl">🏔️</div>
        )}
        {full && (
          <span className="absolute left-3 top-3 rounded-full bg-terracotta-500 px-2.5 py-1 text-xs font-semibold text-white">
            {closed ? t("signup.closed") : t("toursPage.full")}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[21px] font-bold leading-snug text-heading">{tour.title}</h3>

        <div className="mt-3 space-y-1.5 text-sm text-ink">
          <p className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            {date}
          </p>
          <p className="flex items-start gap-2">
            <svg viewBox="0 0 24 24" className={`${icon} mt-0.5`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span className="flex flex-wrap gap-x-1.5">
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
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`${chip} ${DIFFICULTY_CHIP[tour.difficulty] ?? NEUTRAL_CHIP}`}>{t(`difficulty.${tour.difficulty}`)}</span>
          {tour.overnight && <span className={`${chip} bg-apricot-100 text-apricot-700`}>🌙 {t("common.overnight")}</span>}
          <span className={`${chip} ${NEUTRAL_CHIP}`}>{t("common.upTo", { count: tour.max_participants })}</span>
        </div>

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
            <p className="min-w-0 text-sm">
              <span className="block text-xs text-muted">{t("tour.organizer")}</span>
              <Link href={clubHref} className="font-semibold text-heading hover:text-terracotta-700">
                {tour.club.name}
              </Link>
              {tour.club.rating && (
                <span className="ml-1 text-muted">
                  (<span className="text-apricot-500">★</span> {tour.club.rating.average.toFixed(1)}/5)
                </span>
              )}
            </p>
            <p className="shrink-0 whitespace-nowrap font-bold text-heading">
              {Number(tour.price) > 0 ? t("common.perPerson", { price: formatAmd(tour.price) }) : t("common.free")}
            </p>
          </div>
          <button
            data-view
            type="button"
            onClick={onOpen}
            className="mt-3 w-full rounded-full bg-spruce-500 px-4 py-2.5 text-sm font-semibold text-card hover:bg-spruce-900"
          >
            {t("toursPage.seeMore")}
          </button>
        </div>
      </div>
    </article>
  );
}
