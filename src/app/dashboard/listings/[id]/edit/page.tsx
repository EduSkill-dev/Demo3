import { getSightOptions } from "@/lib/sights";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { getT } from "@/i18n/server";
import { getBusinessSettings } from "@/lib/business";
import { tourStartsAt } from "@/lib/catalog";
import TourForm from "@/components/TourForm";
import type { Tour } from "@/types/database";

export default async function EditTourPage({ params }: { params: { id: string } }) {
  const mine = await getMyClub();
  if (!mine) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("tours")
    .select("*")
    .eq("id", params.id)
    .eq("club_id", mine.club.id)
    .maybeSingle();
  if (!data) notFound();

  const t = await getT();
  const tour = data as Tour;
  // A hike that has taken place stays as it was: changing it means a new listing made from a copy.
  if (tour.date < new Date().toISOString().slice(0, 10)) redirect(`/dashboard/listings/new?from=${tour.id}`);
  const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).eq("tour_id", tour.id).eq("status", "confirmed");
  const booked = count ?? 0;
  const late = tourStartsAt(tour.date, tour.meeting_time).getTime() - Date.now() < tour.cancel_hours * 3600 * 1000;
  if (booked > 0 && late) {
    return (
      <div>
        <h2 className="mb-6 font-serif text-xl font-semibold text-heading">{t("announcements.editTitle")}</h2>
        <p className="max-w-2xl rounded-lg border border-line bg-surface p-4 text-sm text-ink">{t("tourChange.tooLate", { hours: tour.cancel_hours })}</p>
      </div>
    );
  }
  return (
    <div>
      <h2 className="mb-6 font-serif text-xl font-semibold text-heading">{t("announcements.editTitle")}</h2>
      <TourForm mode="edit" booked={booked} changeLimit={(await getBusinessSettings()).tour_change_limit} clubId={mine.club.id} clubPhone={mine.club.phone ?? ""} initialTour={tour} sights={await getSightOptions()} planner={mine.limits.config.planner_other_clubs} />
    </div>
  );
}
