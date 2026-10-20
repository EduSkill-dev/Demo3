import Link from "next/link";
import LikeButton from "@/components/LikeButton";
import type { Place } from "@/lib/places";
import type { TFunction as T } from "@/i18n/translate";

const DIFFICULTY_CHIP: Record<string, string> = {
  easy: "bg-spruce-100 text-spruce-700",
  hard: "bg-terracotta-100 text-terracotta-700",
};
const NEUTRAL_CHIP = "bg-sand text-[#5A4A2E] dark:text-ink";
const chip = "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold leading-none";

// Heights are written with a space between thousands: 2 597.
export const metres = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// One place on the Places page: photo · name · region and kind · difficulty
// and hearts · how many hikes go there.
export default function PlaceCard({ place, t }: { place: Place; t: T }) {
  const href = `/places/${place.id}`;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-terracotta-300/70 hover:shadow-lg">
      <Link href={href} className="block" aria-label={place.name}>
        {place.photo ? (
          <img src={place.photo} alt="" loading="lazy" className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-48 items-center justify-center bg-gradient-to-br from-spruce-500 to-spruce-300 text-4xl">🏔️</div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[17px] font-bold leading-snug text-heading">
          <Link href={href} className="hover:text-terracotta-700 hover:underline dark:hover:text-terracotta-300">{place.name}</Link>
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          {t(`region.${place.region}`)}
          {place.terrain ? ` · ${t(`terrain.${place.terrain}`)}` : ""}
          {place.elevation !== null ? ` · ${t("placesPage.meters", { n: metres(place.elevation) })}` : ""}
        </p>
        {place.relativeHeight !== null && (
          <p className="text-[13px] text-muted">{t("placesPage.relativeHeight", { n: metres(place.relativeHeight) })}</p>
        )}
        <div className="mt-2.5 flex items-center gap-2">
          {place.difficulty && (
            <span className={`${chip} ${DIFFICULTY_CHIP[place.difficulty] ?? NEUTRAL_CHIP}`}>{t(`difficulty.${place.difficulty}`)}</span>
          )}
          <span className="ml-auto flex h-6 items-center">
            <LikeButton kind="sight" id={place.id} count={place.likes} />
          </span>
        </div>
        <div className="mt-auto pt-3">
          <Link
            href={href}
            className={`flex items-center justify-between gap-2 border-t border-line pt-3 text-sm font-semibold ${
              place.upcoming > 0 ? "text-spruce-700 hover:text-terracotta-700 dark:text-spruce-300" : "text-muted"
            }`}
          >
            {place.upcoming > 0 ? t("placesPage.upcoming", { count: place.upcoming }) : t("placesPage.noUpcoming")}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
