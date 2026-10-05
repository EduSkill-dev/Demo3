"use client";

import Modal from "@/components/ui/Modal";
import TourDetails from "@/components/tour/TourDetails";
import TourSignup from "@/components/TourSignup";
import type { PublicTour } from "@/lib/publicTours";

// "See more": the full announcement, with the sign-up pinned to the bottom of
// the dialog so it is visible without scrolling (the hike's own page stays
// available for sharing).
export default function TourQuickView({ tour, onClose }: { tour: PublicTour | null; onClose: () => void }) {
  return (
    <Modal
      open={!!tour}
      onClose={onClose}
      title={tour?.title ?? ""}
      size="lg"
      footer={
        tour && (
          <TourSignup
            key={tour.id}
            bare
            tourId={tour.id}
            clubId={tour.club_id}
            cancelHours={tour.cancel_hours}
            date={tour.date}
            taken={tour.taken}
            limit={tour.cap}
            total={tour.max_participants}
            meetingTime={tour.meeting_time}
            price={Number(tour.price) || 0}
          />
        )
      }
    >
      {tour && <TourDetails key={tour.id} tour={tour} seats={{ taken: tour.taken, cap: tour.cap }} />}
    </Modal>
  );
}
