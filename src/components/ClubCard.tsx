import Link from "next/link";
import type { Club } from "@/types/database";
import type { TFunction } from "@/i18n/translate";
import { orderFocus } from "@/lib/catalog";
import CertifiedBadge from "@/components/club/CertifiedBadge";

export default function ClubCard({
  club,
  rating,
  upcoming,
  t,
}: {
  club: Club;
  rating: { average: number; count: number } | null; // null = hidden by package or none yet
  upcoming: number;
  t: TFunction;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:shadow-md">
      {/* The logo in one round frame of the same size on every card,
          whatever was uploaded: it fills the circle (the corners go, the
          middle, where a logo's name sits, stays whole). */}
      <Link href={`/clubs/${club.id}`} className="flex h-40 items-center justify-center bg-gradient-to-b from-sand to-sand/30" aria-label={club.name}>
        <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white shadow-md ring-1 ring-line">
          {club.photo_url ? (
            <img src={club.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 32 32" className="h-12 w-12 text-spruce-500" fill="currentColor" aria-hidden="true">
              <path d="M13 7 3 26h12Z" opacity=".55" />
              <path d="M20 12 11 26h18Z" />
            </svg>
          )}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <span className="flex items-center gap-1.5">
          <Link href={`/clubs/${club.id}`} className="font-serif text-xl font-semibold text-heading hover:text-terracotta-700">
            {club.name}
          </Link>
          {club.certificate_status === "approved" && <CertifiedBadge clubHref={`/clubs/${club.id}`} />}
        </span>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {rating && (
            <span>
              <span className="font-semibold text-terracotta-500">★ {rating.average.toFixed(1)}/5</span>{" "}
              <span className="text-muted">· {t("clubsPage.reviews", { count: rating.count })}</span>
            </span>
          )}
        </p>
        {club.focus?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {orderFocus(club.focus).map((f) => (
              <span key={f} className="rounded-full bg-sand px-2.5 py-0.5 text-xs text-ink">{t(`focus.${f}`)}</span>
            ))}
          </div>
        )}
        <p className="mt-auto pt-4 text-sm font-medium text-muted">{t("clubsPage.upcoming", { count: upcoming })}</p>
      </div>
    </article>
  );
}
