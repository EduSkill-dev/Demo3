import { getSightOptions } from "@/lib/sights";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { getT } from "@/i18n/server";
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
  return (
    <div>
      <h2 className="mb-6 font-serif text-xl font-semibold text-heading">{t("announcements.editTitle")}</h2>
      <TourForm mode="edit" clubId={mine.club.id} clubPhone={mine.club.phone ?? ""} initialTour={tour} seatCap={mine.limits.maxPerTour} sights={await getSightOptions()} planner={mine.limits.config.planner_other_clubs} />
    </div>
  );
}
