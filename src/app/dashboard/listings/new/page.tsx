import { getSightOptions } from "@/lib/sights";
import { redirect } from "next/navigation";
import { getMyClub } from "@/lib/myClub";
import { getT } from "@/i18n/server";
import TourForm from "@/components/TourForm";
import { createClient } from "@/lib/supabase/server";
import type { Tour } from "@/types/database";

// ?from=<id> starts the form as a copy of one of the club's own hikes
// ("publish again"): a new listing, with a new date to choose.
export default async function NewTourPage({ searchParams }: { searchParams: { from?: string } }) {
  const mine = await getMyClub();
  if (!mine) redirect("/login");
  // No package, the cap is reached, or an admin switched posting off: the
  // listings page explains why.
  if (mine.limits.used >= mine.limits.maxListings || mine.club.posting_blocked) redirect("/dashboard");

  const t = await getT();
  let template: Tour | undefined;
  if (searchParams.from && /^[0-9a-f-]{36}$/i.test(searchParams.from)) {
    const { data } = await (await createClient()).from("tours").select("*").eq("id", searchParams.from).eq("club_id", mine.club.id).maybeSingle();
    template = (data as Tour | null) ?? undefined;
  }
  return (
    <div>
      <h2 className="mb-6 font-serif text-xl font-semibold text-heading">{t("announcements.newTitle")}</h2>
      <TourForm mode="create" template={template} clubId={mine.club.id} seatCap={mine.limits.maxPerTour} sights={await getSightOptions()} />
    </div>
  );
}
