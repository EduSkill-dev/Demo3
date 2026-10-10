import Link from "next/link";
import type { Club } from "@/types/database";
import type { TFunction } from "@/i18n/translate";
import FavoriteToggle from "@/components/FavoriteToggle";
import LikeButton from "@/components/LikeButton";

export default function ClubCard({
  club,
  rating,
  upcoming,
  likes,
  t,
}: {
  club: Club;
  rating: { average: number; count: number } | null; // null = hidden by package or none yet
  upcoming: number;
  likes: number; // hearts from people who hiked with the club
  t: TFunction;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:shadow-md">
      <div className="relative">
        <Link href={`/clubs/${club.id}`}>
          {club.photo_url ? (
            <div className="flex h-44 items-center justify-center bg-sand">
              <img src={club.photo_url} alt={club.name} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-44 items-center justify-center bg-gradient-to-br from-spruce-500 to-spruce-300 text-4xl">🏔️</div>
          )}
        </Link>
        {/* The bookmark: follow this club (individuals only). */}
        <div className="absolute right-3 top-3">
          <FavoriteToggle compact clubId={club.id} clubName={club.name} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Link href={`/clubs/${club.id}`} className="font-serif text-xl font-semibold text-heading hover:text-terracotta-700">
          {club.name}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {rating && (
            <span>
              <span className="font-semibold text-terracotta-500">★ {rating.average.toFixed(1)}/5</span>{" "}
              <span className="text-muted">· {t("clubsPage.reviews", { count: rating.count })}</span>
            </span>
          )}
          <LikeButton kind="club" id={club.id} count={likes} />
        </p>
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
