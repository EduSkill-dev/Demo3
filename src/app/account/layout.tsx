import DashboardShell from "@/components/ui/DashboardShell";
import { getT } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";

// Only individual accounts get here — src/middleware.ts checks the role on the server.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { count: unread } = user
    ? await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false)
    : { count: 0 };

  return (
    <DashboardShell
      title={t("nav.account.title")}
      items={[
        { href: "/account", label: t("nav.account.tours") },
        { href: "/account/requests", label: t("nav.account.requests") },
        { href: "/account/history", label: t("nav.account.history") },
        { href: "/account/favorites", label: t("nav.account.favorites") },
        { href: "/account/notifications", label: t("nav.account.notifications"), badge: unread ?? 0 },
        { href: "/account/comments", label: t("nav.account.comments") },
        { href: "/account/profile", label: t("nav.account.profile") },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
