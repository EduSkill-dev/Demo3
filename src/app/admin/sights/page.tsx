import { redirect } from "next/navigation";
import { can, getAdmin } from "@/lib/admin";
import { getAllSights } from "@/lib/sights";
import SightsManager from "@/components/admin/SightsManager";

// The platform's list of sights: clubs tick them on listings, individuals on
// custom requests. Entries are hidden rather than deleted, so what already
// refers to them keeps its text.
export default async function AdminSightsPage() {
  const me = await getAdmin();
  if (!me || !can(me, "pages")) redirect("/admin");
  return <SightsManager sights={await getAllSights()} />;
}
