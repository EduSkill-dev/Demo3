import DashboardShell from "@/components/ui/DashboardShell";
import { getT } from "@/i18n/server";

// Only club accounts get here — src/middleware.ts checks the role on the server.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <DashboardShell
      title={t("nav.club.title")}
      items={[
        { href: "/dashboard", label: t("nav.club.announcements") },
        { href: "/dashboard/applications", label: t("nav.club.applications") },
        { href: "/dashboard/club", label: t("nav.club.data") },
        { href: "/dashboard/packages", label: t("nav.club.packages") },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
