import Link from "next/link";
import { DIFFICULTY_COLORS } from "@/lib/calendar";
import type { PublicTour } from "@/lib/publicTours";
import type { TFunction } from "@/i18n/translate";
import type { Difficulty } from "@/types/database";

// Pieces the calendar's month view, side panel and agenda share. All of
// them are plain server-rendered markup.

export function MoonIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function DifficultyChip({ level, label, night, nightLabel }: { level: Difficulty; label: string; night?: boolean; nightLabel?: string }) {
  const c = DIFFICULTY_COLORS[level];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: c.bg, color: c.text }}>
      {night && <MoonIcon />}
      {night && nightLabel && <span className="sr-only">{nightLabel}, </span>}
      {label}
    </span>
  );
}

// The hike's photo, or a tile in the difficulty's colour with the mountain mark.
export function Thumb({ tour, size }: { tour: PublicTour; size: 56 | 64 }) {
  const c = DIFFICULTY_COLORS[tour.difficulty];
  const box = size === 64 ? "h-16 w-16" : "h-14 w-14";
  return tour.photo_urls?.[0] ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={tour.photo_urls[0]} alt="" loading="lazy" className={`${box} shrink-0 rounded-xl object-cover`} />
  ) : (
    <span className={`${box} flex shrink-0 items-center justify-center rounded-xl`} style={{ background: c.bg, color: c.text }} aria-hidden="true">
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor">
        <path d="M13 7 3 26h12Z" opacity=".55" />
        <path d="M20 12 11 26h18Z" />
      </svg>
    </span>
  );
}

// Seats still free; null when sign-up is not possible any more.
export function seatsLeft(tour: PublicTour, today: string): number | null {
  if (tour.date < today) return null;
  return Math.max(0, tour.cap - tour.taken);
}

export function ClubAvatar({ club }: { club: PublicTour["club"] }) {
  return club.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={club.photo} alt="" loading="lazy" className="h-[22px] w-[22px] shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-spruce-500 text-[11px] font-bold text-card" aria-hidden="true">
      {club.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

// Side panel: one hike of the chosen day.
export function PanelCard({ tour, today, t }: { tour: PublicTour; today: string; t: TFunction }) {
  const c = DIFFICULTY_COLORS[tour.difficulty];
  const left = seatsLeft(tour, today);
  const share = tour.cap > 0 ? Math.min(100, Math.round((tour.taken / tour.cap) * 100)) : 100;
  return (
    <article className="rounded-[18px] border border-line bg-surface p-3.5">
      <div className="flex gap-3">
        <Thumb tour={tour} size={64} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-heading">{tour.title}</h3>
          <p className="mt-1 flex gap-1 text-[13px] text-muted">
            <PinIcon />
            <span className="min-w-0">{tour.regions.map((r) => t(`region.${r}`)).join(", ")}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link href={`/clubs/${tour.club.id}`} className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-ink hover:underline">
          <ClubAvatar club={tour.club} />
          <span className="truncate">{tour.club.name}</span>
        </Link>
        <DifficultyChip level={tour.difficulty} label={t(`difficulty.${tour.difficulty}`)} night={tour.overnight} nightLabel={t("calendar.night")} />
      </div>
      {left === null ? (
        <p className="mt-3 text-[13px] text-muted">{t("calendar.past")}</p>
      ) : (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: c.bg }} aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${share}%`, background: c.bar }} />
          </div>
          <p className="mt-1.5 text-[13px] font-medium text-ink">{left > 0 ? t("calendar.spotsLeft", { count: left }) : t("calendar.full")}</p>
        </>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Link href={`/tours/${tour.id}`} className="flex h-10 flex-1 items-center justify-center rounded-full bg-spruce-500 px-4 text-sm font-semibold text-card hover:bg-spruce-900">
          {t("toursPage.seeMore")}
        </Link>
        <a
          href={`/tours/${tour.id}/calendar.ics`}
          title={t("calendar.addToMine")}
          aria-label={`${t("calendar.addToMine")}՝ ${tour.title}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-line text-ink hover:border-spruce-500"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5" />
          </svg>
        </a>
      </div>
    </article>
  );
}

// Agenda (phones, and the desktop list view): one compact card, all of it a link.
export function AgendaCard({ tour, today, t }: { tour: PublicTour; today: string; t: TFunction }) {
  const left = seatsLeft(tour, today);
  return (
    <Link href={`/tours/${tour.id}`} className="flex min-h-[44px] gap-3 rounded-[18px] border border-line bg-surface p-3 transition hover:border-spruce-500">
      <Thumb tour={tour} size={56} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-base font-bold leading-snug text-heading">{tour.title}</span>
        <span className="mt-0.5 truncate text-[13px] text-muted">
          {tour.club.name} · {tour.regions.map((r) => t(`region.${r}`)).join(", ")}
        </span>
        <span className="mt-2 flex items-center justify-between gap-2">
          <DifficultyChip level={tour.difficulty} label={t(`difficulty.${tour.difficulty}`)} night={tour.overnight} nightLabel={t("calendar.night")} />
          <span className="whitespace-nowrap text-[13px] font-semibold text-ink">
            {left === null ? t("calendar.past") : left > 0 ? t("calendar.seats", { count: left }) : t("calendar.full")}
          </span>
        </span>
      </span>
    </Link>
  );
}
