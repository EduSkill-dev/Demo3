"use client";

import { useState } from "react";
import Link from "next/link";
import type { Tour } from "@/types/database";
import { cancelHoursOf, formatAmd } from "@/lib/catalog";
import { useFormatDate, useT } from "@/i18n/client";
import FramedPhoto from "@/components/ui/FramedPhoto";
import LikeButton from "@/components/LikeButton";

// One picture per thing to bring, so the list reads at a glance.
const BRING_ICONS: Record<string, string> = {
  boots: "🥾", warm_clothes: "🧥", rain_jacket: "☔", hat: "🧢", sunglasses: "🕶️", sunscreen: "🧴", water: "💧", food: "🥪", backpack: "🎒",
  poles: "🎿", headlamp: "🔦", first_aid: "🩹", id_card: "🪪", cash: "💵", swimsuit: "🩱", sleeping_bag: "🛌", tent: "⛺", mat: "🧘",
};


export type TourForDetails = Pick<
  Tour,
  | "id" | "title" | "description" | "regions" | "terrains" | "date" | "max_participants" | "photo_urls"
  | "overnight" | "difficulty" | "coordinator_phone" | "notes" | "meeting_point" | "meeting_time" | "price"
> & Partial<Pick<Tour, "bring_items">
> & {
  cancel_hours?: number | null;
  end_date?: string | null;
  club?: { id: string; name: string } | null;
  sights?: { id: string; name: string }[];
  likes?: number; // shown (and likeable) when the page supplied the count
};

// The full announcement — used inside modals ("View", "See more").
// `seats.cap` is what the platform accepts under the club's package; the
// total shown next to it is the hike's own size, set by the club.
export default function TourDetails({
  tour,
  seats,
  showPageLink = true,
}: {
  tour: TourForDetails;
  seats?: { taken: number; cap: number };
  showPageLink?: boolean;
}) {
  const t = useT();
  const fmt = useFormatDate();
  const date = fmt(tour.date, "weekdayLong") + (tour.end_date && tour.end_date > tour.date ? ` – ${fmt(tour.end_date, "weekdayLong")}` : "");
  const photos = tour.photo_urls ?? [];
  const [shown, setShown] = useState(0);
  const photo = photos[Math.min(shown, photos.length - 1)];

  const rows: [string, React.ReactNode][] = [
    [t("tour.date"), date],
    [t("tour.regions"), tour.regions.map((r) => t(`region.${r}`)).join(", ") || "—"],
    [t("tour.terrains"), tour.terrains.map((k) => t(`terrain.${k}`)).join(", ") || "—"],
    // Each place links to its own page.
    ...(tour.sights?.length
      ? ([[
          t("tour.sights"),
          <span key="sights">
            {tour.sights.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <Link href={`/places/${s.id}`} className="underline decoration-line underline-offset-2 hover:text-terracotta-700 dark:hover:text-terracotta-300">{s.name}</Link>
              </span>
            ))}
          </span>,
        ]] as [string, React.ReactNode][])
      : []),
    [t("tour.difficulty"), t(`difficulty.${tour.difficulty}`)],
    [t("tour.overnight"), tour.overnight ? t("tour.yes") : t("tour.no")],
    [
      t("tour.capacity"),
      seats
        ? seats.cap <= 0
          ? t("signup.closed")
          : seats.taken >= seats.cap
          ? t("tour.full")
          : t("tour.seatsLeft", { free: seats.cap - seats.taken, cap: Math.max(tour.max_participants, seats.cap) })
        : t("common.upTo", { count: tour.max_participants }),
    ],
    [t("tour.price"), Number(tour.price) > 0 ? t("common.perPerson", { price: formatAmd(tour.price) }) : t("common.free")],
    ...(tour.meeting_point ? ([[t("tour.meetingPoint"), tour.meeting_point]] as [string, React.ReactNode][]) : []),
    ...(tour.meeting_time ? ([[t("tour.meetingTime"), tour.meeting_time.slice(0, 5)]] as [string, React.ReactNode][]) : []),
    [
      t("tour.coordinator"),
      <a key="phone" href={`tel:${tour.coordinator_phone.replace(/\s/g, "")}`} className="text-terracotta-500 hover:underline">
        {tour.coordinator_phone}
      </a>,
    ],
    [t("tour.cancellation"), t("tour.cancellationText", { hours: cancelHoursOf(tour) })],
  ];

  return (
    <div className="space-y-5 text-sm">
      {photo ? (
        <div className="space-y-2">
          <FramedPhoto src={photo} alt={tour.title} />
          {photos.length > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto p-0.5">
              {photos.map((u, i) => (
                <button data-view
                  key={`${u}-${i}`}
                  type="button"
                  onClick={() => setShown(i)}
                  aria-label={t("tour.photo", { n: i + 1 })}
                  aria-current={u === photo}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 ${
                    u === photo ? "ring-terracotta-500" : "ring-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center rounded-xl bg-gradient-to-br from-spruce-500 to-spruce-300 text-4xl">🏔️</div>
      )}

      <div>
        {tour.club && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {t("tour.organiser")}՝{" "}
              <Link href={`/clubs/${tour.club.id}`} className="font-semibold text-terracotta-700 underline decoration-terracotta-500/50 underline-offset-4 hover:decoration-terracotta-500 dark:text-terracotta-300">
                {tour.club.name}
              </Link>
            </p>
          </div>
        )}
        <div className="mt-1 flex items-start justify-between gap-3">
          <h3 className="font-serif text-2xl font-semibold text-heading">{tour.title}</h3>
          {tour.likes !== undefined && (
            <span className="mt-1 shrink-0">
              <LikeButton kind="tour" id={tour.id} count={tour.likes} size="md" />
            </span>
          )}
        </div>
      </div>

      {tour.description && <p className="whitespace-pre-line leading-6 text-ink">{tour.description}</p>}

      <dl className="divide-y divide-line rounded-xl border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {((tour.bring_items ?? []).length > 0 || tour.notes) && (
        <section className="rounded-2xl border border-line bg-sand/50 p-4 sm:p-5">
          <h4 className="flex items-center gap-2 text-lg font-bold text-heading">
            <span aria-hidden="true">🎒</span>
            {t("tour.whatToBring")}
          </h4>
          {(tour.bring_items ?? []).length > 0 && (
            <ul className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3">
              {(tour.bring_items ?? []).map((k) => (
                <li key={k} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand text-base" aria-hidden="true">{BRING_ICONS[k] ?? "•"}</span>
                  <span className="min-w-0">{t(`bring.${k}`)}</span>
                </li>
              ))}
            </ul>
          )}
          {tour.notes && <p className="mt-3 whitespace-pre-line leading-6 text-ink">{tour.notes}</p>}
        </section>
      )}

      {showPageLink && (
        <Link href={`/tours/${tour.id}`} className="inline-block font-semibold text-terracotta-500 hover:text-terracotta-700">
          {t("tour.openPage")} →
        </Link>
      )}
    </div>
  );
}
