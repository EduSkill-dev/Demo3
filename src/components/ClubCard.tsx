import Link from "next/link";
import type { Club } from "@/types/database";
import type { TFunction } from "@/i18n/translate";

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
      <Link href={`/clubs/${club.id}`}>
        {club.photo_url ? (
          <div className="flex h-44 items-center justify-center bg-sand">
            <img src={club.photo_url} alt={club.name} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-44 items-center justify-center bg-gradient-to-br from-pine to-apricot/70 text-4xl">🏔️</div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link href={`/clubs/${club.id}`} className="font-serif text-xl font-semibold text-heading hover:text-apricot-dark">
          {club.name}
        </Link>
        {rating && (
          <p className="mt-1 text-sm">
            <span className="font-semibold text-apricot">★ {rating.average.toFixed(1)}/5</span>{" "}
            <span className="text-muted">· {t("clubsPage.reviews", { count: rating.count })}</span>
          </p>
        )}
        {club.focus?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {club.focus.map((f) => (
              <span key={f} className="rounded-full bg-sand px-2.5 py-0.5 text-xs text-ink">{t(`focus.${f}`)}</span>
            ))}
          </div>
        )}
        <p className="mt-auto pt-4 text-sm font-medium text-muted">{t("clubsPage.upcoming", { count: upcoming })}</p>
      </div>
    </article>
  );
}
