import DashboardShell from "@/components/ui/DashboardShell";
import { getT } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";

// Only club accounts get here — src/middleware.ts checks the role on the server.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();

  // Unread applications (new ones and cancellations) badge the Applications item.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { count: unread } = user
    ? await supabase
        .from("bookings")
        .select("id, tours!inner(club_id, clubs!inner(owner_id))", { count: "exact", head: true })
        .eq("tours.clubs.owner_id", user.id)
        .is("read_at", null)
    : { count: 0 };

  const { count: unreadNotices } = user
    ? await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false)
    : { count: 0 };

  return (
    <DashboardShell
      title={t("nav.club.title")}
      items={[
        { href: "/dashboard", label: t("nav.club.announcements") },
        { href: "/dashboard/applications", label: t("nav.club.applications"), badge: unread ?? 0 },
        { href: "/dashboard/offers", label: t("nav.club.offers") },
        { href: "/dashboard/notifications", label: t("nav.club.notifications"), badge: unreadNotices ?? 0 },
        { href: "/dashboard/club", label: t("nav.club.data") },
        { href: "/dashboard/packages", label: t("nav.club.packages") },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
