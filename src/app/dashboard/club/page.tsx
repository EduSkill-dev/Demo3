import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import type { ClubGuide } from "@/types/database";
import ClubProfileForm from "@/components/club/ClubProfileForm";
import GuidesEditor from "@/components/club/GuidesEditor";

export default async function ClubDataPage() {
  const mine = await getMyClub();
  if (!mine) redirect("/login");
  const supabase = await createClient();
  const { data: guides } = await supabase
    .from("club_guides")
    .select("*")
    .eq("club_id", mine.club.id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-10">
      <ClubProfileForm club={mine.club} />
      <GuidesEditor clubId={mine.club.id} initial={(guides ?? []) as ClubGuide[]} />
    </div>
  );
}
