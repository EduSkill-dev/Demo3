import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlace } from "@/lib/places";
import { getPublicTours } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import { getViewer } from "@/lib/viewer";
import LikeButton from "@/components/LikeButton";
import { metres } from "@/components/places/PlaceCard";
import TourGrid from "@/components/tour/TourGrid";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const place = UUID.test(params.id) ? await getPlace(params.id) : null;
  if (!place) return {};
  const t = await getT();
  const description = place.description ?? `${place.name} · ${t(`region.${place.region}`)}`;
  return { title: place.name, description, openGraph: { title: place.name, description, url: `/places/${place.id}`, ...(place.photo ? { images: [{ url: place.photo, alt: place.name }] } : {}) } };
}

const DIFFICULTY_CHIP: Record<string, string> = {
  easy: "bg-spruce-100 text-spruce-700",
  hard: "bg-terracotta-100 text-terracotta-700",
};

// One place: photo, what kind of place it is, hearts, a few words, and the
// hikes that go there next. Someone who wants to hear of new hikes here can
// save a search for it in one step.
export default async function PlacePage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  const [t, place, viewer] = await Promise.all([getT(), getPlace(params.id), getViewer()]);
  if (!place) notFound();
  const tours = (await getPublicTours()).filter((x) => (x.sight_ids ?? []).includes(place.id));
  const notify =
    viewer?.role === "individual"
      ? `/account/searches?sight=${place.id}`
      : !viewer
        ? `/login?next=${encodeURIComponent(`/account/searches?sight=${place.id}`)}`
        : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link href="/places" className="text-sm font-semibold text-muted hover:text-terracotta-700">{t("placesPage.back")}</Link>

      <section className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        {place.photo ? (
          <img src={place.photo} alt={place.name} className="h-64 w-full rounded-2xl object-cover sm:h-80" />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-2xl bg-gradient-to-br from-spruce-500 to-spruce-300 text-6xl sm:h-80">🏔️</div>
        )}
        <div>
          <h1 className="font-serif text-3xl font-semibold text-heading">{place.name}</h1>
          <p className="mt-1 text-muted">
            {t(`region.${place.region}`)}
            {place.terrain ? ` · ${t(`terrain.${place.terrain}`)}` : ""}
            {place.elevation !== null ? ` · ${t("placesPage.meters", { n: metres(place.elevation) })}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {place.difficulty && (
              <span className={`inline-flex h-7 items-center rounded-full px-3 text-sm font-semibold leading-none ${DIFFICULTY_CHIP[place.difficulty] ?? "bg-sand text-[#5A4A2E] dark:text-ink"}`}>
                {t(`difficulty.${place.difficulty}`)}
              </span>
            )}
            <LikeButton kind="sight" id={place.id} count={place.likes} size="md" />
            <span className="text-sm text-muted">{tours.length > 0 ? t("placesPage.upcoming", { count: tours.length }) : t("placesPage.noUpcoming")}</span>
          </div>
          {place.relativeHeight !== null && (
            <p className="mt-2 text-sm text-muted">{t("placesPage.relativeHeight", { n: metres(place.relativeHeight) })}</p>
          )}
          {place.description && <p className="mt-4 whitespace-pre-line leading-relaxed text-ink">{place.description}</p>}
          {notify && (
            <Link href={notify} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-spruce-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {t("placesPage.saveSearch")}
            </Link>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold text-heading">{t("placesPage.upcomingTitle")}</h2>
        {tours.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-8 text-center text-muted">{t("placesPage.noUpcomingLong")}</p>
        ) : (
          <TourGrid tours={tours} size="sm" columns="sm:grid-cols-2 lg:grid-cols-3" backHref={`/places/${place.id}`} />
        )}
      </section>
    </main>
  );
}
