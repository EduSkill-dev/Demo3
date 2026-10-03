import DashboardShell from "@/components/ui/DashboardShell";
import { getT } from "@/i18n/server";

// Only individual accounts get here — src/middleware.ts checks the role on the server.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <DashboardShell
      title={t("nav.account.title")}
      items={[
        { href: "/account", label: t("nav.account.tours") },
        { href: "/account/history", label: t("nav.account.history") },
        { href: "/account/favorites", label: t("nav.account.favorites") },
        { href: "/account/notifications", label: t("nav.account.notifications") },
        { href: "/account/comments", label: t("nav.account.comments") },
        { href: "/account/profile", label: t("nav.account.profile") },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
