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
  // Without an active package the current capacity can still be kept.
  const tour = data as Tour;
  const seatCap = Math.max(mine.limits.maxPerTour, mine.limits.pkg ? 0 : tour.max_participants);
  return (
    <div>
      <h2 className="mb-6 font-serif text-xl font-semibold text-heading">{t("announcements.editTitle")}</h2>
      <TourForm mode="edit" clubId={mine.club.id} initialTour={tour} seatCap={seatCap} />
    </div>
  );
}
