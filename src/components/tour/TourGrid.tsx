"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicTour } from "@/lib/publicTours";
import TourCard from "./TourCard";
import TourQuickView from "./TourQuickView";

// A plain grid of hike cards with the "See more" modal (home, club pages).
// Clicking a region opens the Tours page filtered by it.
export default function TourGrid({
  tours,
  backHref,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  tours: PublicTour[];
  backHref?: string;
  columns?: string; // narrower containers (club page) pass "sm:grid-cols-2"
}) {
  const router = useRouter();
  const [open, setOpen] = useState<PublicTour | null>(null);
  return (
    <>
      <div className={`grid gap-6 ${columns}`}>
        {tours.map((tour) => (
          <TourCard
            key={tour.id}
            tour={tour}
            backHref={backHref}
            onRegion={(region) => router.push(`/tours?region=${region}`)}
            onOpen={() => setOpen(tour)}
          />
        ))}
      </div>
      <TourQuickView tour={open} onClose={() => setOpen(null)} />
    </>
  );
}
