import { createClient } from "@/lib/supabase/server";
import HeaderBar, { type HeaderUser } from "./HeaderBar";

// Rendered on the server from the session cookie, so the right buttons show
// on first paint (no "Log in" flash for signed-in people).
export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let headerUser: HeaderUser | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, first_name")
      .eq("id", user.id)
      .single();
    const p = profile as { role: "individual" | "club"; first_name: string | null } | null;

    if (p?.role === "club") {
      const { data: club } = await supabase.from("clubs").select("name").eq("owner_id", user.id).single();
      headerUser = { role: "club", name: (club as { name?: string } | null)?.name ?? "", unread: 0 };
    } else if (p) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      headerUser = { role: "individual", name: p.first_name ?? "", unread: count ?? 0 };
    }
  }

  return <HeaderBar user={headerUser} />;
}
