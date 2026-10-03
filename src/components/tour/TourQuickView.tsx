"use client";

import Modal from "@/components/ui/Modal";
import TourDetails from "@/components/tour/TourDetails";
import TourSignup from "@/components/TourSignup";
import type { PublicTour } from "@/lib/publicTours";

// "See more": the full announcement plus the sign-up card, without leaving
// the list (the hike's own page stays available for sharing).
export default function TourQuickView({ tour, onClose }: { tour: PublicTour | null; onClose: () => void }) {
  return (
    <Modal open={!!tour} onClose={onClose} title={tour?.title ?? ""} size="lg">
      {tour && (
        <div className="space-y-5">
          <TourDetails tour={tour} seats={{ taken: tour.taken, cap: tour.cap }} />
          <TourSignup
            tourId={tour.id}
            date={tour.date}
            taken={tour.taken}
            limit={tour.cap}
            meetingTime={tour.meeting_time}
            price={Number(tour.price) || 0}
          />
        </div>
      )}
    </Modal>
  );
}
