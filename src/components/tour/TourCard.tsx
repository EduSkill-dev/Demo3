"use client";

import Link from "next/link";
import { formatAmd } from "@/lib/catalog";
import { useFormatDate, useT } from "@/i18n/client";
import type { PublicTour } from "@/lib/publicTours";

// One hike on the Tours page / home page:
// photo · regions (click = filter) · club (link) (★ rating) · title ·
// date + overnight · difficulty · "up to N people" · price · See more.
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
  const full = tour.taken >= tour.cap;
  const date = fmt(tour.date, "weekday");
  const clubHref = `/clubs/${tour.club.id}${backHref ? `?back=${encodeURIComponent(backHref)}` : ""}`;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:shadow-md">
      <button type="button" onClick={onOpen} className="relative block" aria-label={tour.title}>
        {tour.photo_urls?.[0] ? (
          <img src={tour.photo_urls[0]} alt="" className="h-44 w-full object-cover" />
        ) : (
          <div className="flex h-44 items-center justify-center bg-gradient-to-br from-pine to-apricot/70 text-4xl">🏔️</div>
        )}
        {full && (
          <span className="absolute left-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
            {t("toursPage.full")}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold uppercase tracking-wide">
          {tour.regions.map((r, i) => (
            <span key={r} className="flex items-center gap-1.5">
              {onRegion ? (
                <button
                  type="button"
                  onClick={() => onRegion(r)}
                  title={t("toursPage.filterByRegion", { region: t(`region.${r}`) })}
                  className="text-apricot hover:text-apricot-dark hover:underline"
                >
                  {t(`region.${r}`)}
                </button>
              ) : (
                <span className="text-apricot">{t(`region.${r}`)}</span>
              )}
              {i < tour.regions.length - 1 && <span className="text-muted">·</span>}
            </span>
          ))}
        </div>

        <p className="mt-1 text-sm">
          <span className="text-muted">{t("tour.organizer")} </span>
          <Link href={clubHref} className="font-semibold text-heading hover:text-apricot-dark">
            {tour.club.name}
          </Link>
          {tour.club.rating && (
            <span className="ml-1 text-muted">
              (<span className="text-apricot">★</span> {tour.club.rating.average.toFixed(1)}/5)
            </span>
          )}
        </p>

        <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-ink">{tour.title}</h3>

        <p className="mt-2 text-sm text-ink">
          {date}
          {tour.overnight && <span className="ml-2 text-muted">🌙 {t("common.overnight")}</span>}
        </p>
        <p className="mt-1 text-sm text-muted">
          {t(`difficulty.${tour.difficulty}`)} · {t("common.upTo", { count: tour.max_participants })}
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
          <p className="whitespace-nowrap font-semibold text-ink">
            {Number(tour.price) > 0 ? t("common.perPerson", { price: formatAmd(tour.price) }) : t("common.free")}
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-apricot hover:text-apricot-dark"
          >
            {t("toursPage.seeMore")}
          </button>
        </div>
      </div>
    </article>
  );
}
