import { redirect } from "next/navigation";
import { can, getAdmin } from "@/lib/admin";
import { getShareNetworks } from "@/lib/siteSettings";
import ShareSettings from "@/components/admin/ShareSettings";

// On which social networks a hike's link can be shared from the site.
// The super admin and admins who manage the site's pages.
export default async function AdminSharePage() {
  const me = await getAdmin();
  if (!me || !can(me, "pages")) redirect("/admin");
  return <ShareSettings enabled={await getShareNetworks()} />;
}
