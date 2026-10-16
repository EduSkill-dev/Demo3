"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import type { PublicTour } from "@/lib/publicTours";
import TourCard from "./TourCard";
import TourQuickView from "./TourQuickView";

// A plain grid of hike cards with the "See more" modal (home, club pages).
// Clicking a region opens the Tours page filtered by it.
export default function TourGrid({
  tours,
  backHref,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
  size = "md",
  first,
  step = 4,
}: {
  tours: PublicTour[];
  backHref?: string;
  columns?: string; // narrower containers (club page) pass "sm:grid-cols-2"
  size?: "md" | "sm";
  first?: number; // show this many, then "more" adds `step` at a time
  step?: number;
}) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState<PublicTour | null>(null);
  const [limit, setLimit] = useState(first ?? tours.length);
  const more = Math.min(step, tours.length - limit);
  return (
    <>
      <div className={`grid ${size === "sm" ? "gap-x-7 gap-y-8" : "gap-x-8 gap-y-10"} ${columns}`}>
        {tours.slice(0, limit).map((tour) => (
          <TourCard
            key={tour.id}
            tour={tour}
            backHref={backHref}
            onRegion={(region) => router.push(`/tours?region=${region}`)}
            onOpen={() => setOpen(tour)}
            size={size}
          />
        ))}
      </div>
      {more > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((n) => n + step)}
            className="rounded-full border-2 border-spruce-900 px-6 py-2.5 text-sm font-semibold text-ink hover:bg-sand dark:border-line"
          >
            {t("toursPage.showMoreHikes")}
          </button>
        </div>
      )}
      <TourQuickView tour={open} onClose={() => setOpen(null)} />
    </>
  );
}
