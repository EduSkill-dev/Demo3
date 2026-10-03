import { redirect } from "next/navigation";
import { getMyClub } from "@/lib/myClub";
import { getT } from "@/i18n/server";
import TourForm from "@/components/TourForm";

export default async function NewTourPage() {
  const mine = await getMyClub();
  if (!mine) redirect("/login");
  // No package, or the cap is reached: the listings page explains why.
  if (mine.limits.used >= mine.limits.maxListings) redirect("/dashboard");

  const t = await getT();
  return (
    <div>
      <h2 className="mb-6 font-serif text-xl font-semibold text-heading">{t("announcements.newTitle")}</h2>
      <TourForm mode="create" clubId={mine.club.id} seatCap={mine.limits.maxPerTour} />
    </div>
  );
}
