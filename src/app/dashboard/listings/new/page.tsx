import { getSightOptions } from "@/lib/sights";
import { redirect } from "next/navigation";
import { getMyClub } from "@/lib/myClub";
import { getT } from "@/i18n/server";
import TourForm from "@/components/TourForm";

export default async function NewTourPage() {
  const mine = await getMyClub();
  if (!mine) redirect("/login");
  // No package, the cap is reached, or an admin switched posting off: the
  // listings page explains why.
  if (mine.limits.used >= mine.limits.maxListings || mine.club.posting_blocked) redirect("/dashboard");

  const t = await getT();
  return (
    <div>
      <h2 className="mb-6 font-serif text-xl font-semibold text-heading">{t("announcements.newTitle")}</h2>
      <TourForm mode="create" clubId={mine.club.id} seatCap={mine.limits.maxPerTour} sights={await getSightOptions()} />
    </div>
  );
}
