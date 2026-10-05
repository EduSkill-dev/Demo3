"use client";

import { useState } from "react";
import Link from "next/link";
import type { Tour } from "@/types/database";
import { cancelHoursOf, formatAmd } from "@/lib/catalog";
import { useFormatDate, useT } from "@/i18n/client";
import FramedPhoto from "@/components/ui/FramedPhoto";

export type TourForDetails = Pick<
  Tour,
  | "id" | "title" | "description" | "regions" | "terrains" | "date" | "max_participants" | "photo_urls"
  | "overnight" | "difficulty" | "coordinator_phone" | "notes" | "meeting_point" | "meeting_time" | "price"
> & { club?: { id: string; name: string; cancel_hours?: number | null } | null };

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
  const date = fmt(tour.date, "weekdayLong");
  const photos = tour.photo_urls ?? [];
  const [shown, setShown] = useState(0);
  const photo = photos[Math.min(shown, photos.length - 1)];

  const rows: [string, React.ReactNode][] = [
    [t("tour.date"), date],
    [t("tour.regions"), tour.regions.map((r) => t(`region.${r}`)).join(", ") || "—"],
    [t("tour.terrains"), tour.terrains.map((k) => t(`terrain.${k}`)).join(", ") || "—"],
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
      <a key="phone" href={`tel:${tour.coordinator_phone.replace(/\s/g, "")}`} className="text-apricot hover:underline">
        {tour.coordinator_phone}
      </a>,
    ],
    [t("tour.cancellation"), t("tour.cancellationText", { hours: cancelHoursOf(tour.club) })],
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
                    u === photo ? "ring-apricot" : "ring-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center rounded-xl bg-gradient-to-br from-pine to-apricot/70 text-4xl">🏔️</div>
      )}

      <div>
        {tour.club && (
          <Link href={`/clubs/${tour.club.id}`} className="text-xs font-semibold uppercase tracking-wide text-apricot hover:text-apricot-dark">
            {tour.club.name}
          </Link>
        )}
        <h3 className="mt-1 font-serif text-2xl font-semibold text-heading">{tour.title}</h3>
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

      {tour.notes && (
        <div className="rounded-xl bg-sand/70 p-4">
          <p className="font-semibold text-heading">{t("tour.whatToBring")}</p>
          <p className="mt-1 whitespace-pre-line text-ink">{tour.notes}</p>
        </div>
      )}

      {showPageLink && (
        <Link href={`/tours/${tour.id}`} className="inline-block font-semibold text-apricot hover:text-apricot-dark">
          {t("tour.openPage")} →
        </Link>
      )}
    </div>
  );
}
