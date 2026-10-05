import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import { getViewer } from "@/lib/viewer";
import HeaderBar, { type HeaderUser } from "./HeaderBar";

// Rendered on the server from the session cookie, so the right buttons show
// on first paint (no "Log in" flash for signed-in people). A blocked account
// is shown as signed out; a frozen one gets a notice above the header.
export default async function SiteHeader() {
  const viewer = await getViewer();

  let headerUser: HeaderUser | null = null;
  if (viewer?.role === "admin") {
    headerUser = { role: "admin", name: "", unread: 0 };
  } else if (viewer?.role === "club") {
    headerUser = { role: "club", name: viewer.club?.name ?? "", unread: 0 };
  } else if (viewer) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewer.id)
      .eq("read", false);
    headerUser = { role: "individual", name: viewer.firstName ?? "", unread: count ?? 0 };
  }

  if (!viewer?.frozen) return <HeaderBar user={headerUser} />;
  const t = await getT();
  return (
    <>
      <p role="status" className="bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">
        {t("account.frozenNotice")}
      </p>
      <HeaderBar user={headerUser} />
    </>
  );
}
