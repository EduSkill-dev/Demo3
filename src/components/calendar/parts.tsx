import type { PublicTour } from "@/lib/publicTours";

// Small pieces the calendar shares. (Its hikes are shown with the same cards
// as the Tours page — components/tour/TourCard.)

export function MoonIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

// Seats still free; null when sign-up is not possible any more.
export function seatsLeft(tour: PublicTour, today: string): number | null {
  if (tour.date < today) return null;
  return Math.max(0, tour.cap - tour.taken);
}
