import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { getFormatDate } from "@/i18n/server";
import { activePackage } from "@/lib/catalog";
import { cleanOverrides } from "@/lib/plans/registry";
import { getPlans } from "@/lib/plans/server";
import { getShareNetworks } from "@/lib/siteSettings";
import { SHARE_NETWORK_IDS } from "@/lib/share";
import { PACKAGE_IDS } from "@/lib/catalog";
import { REPORT_KEYS, cleanReportItems } from "@/lib/report/items";
import type { AccountStatus } from "@/lib/adminLabels";
import AccountsTable, { type AccountRow } from "@/components/admin/AccountsTable";

type Row = {
  name: string;
  phone: string | null;
  tariff: string | null;
  package_ends_at: string | null;
  posting_blocked: boolean;
  applications_blocked: boolean;
  plan_overrides: unknown;
  share_blocked: string[] | null;
  report_items: string[] | null;
  profiles: { id: string; email: string; status: AccountStatus; created_at: string; chat_blocked: boolean } | null;
};

export default async function AdminClubsPage({ searchParams }: { searchParams: { q?: string } }) {
  const me = await getAdmin();
  if (!me || !can(me, "clubs")) redirect("/admin");

  const fmt = await getFormatDate();
  const plans = await getPlans();
  const { data } = await createAdminClient()
    .from("clubs")
    .select("name, phone, tariff, package_ends_at, plan_overrides, share_blocked, report_items, posting_blocked, applications_blocked, profiles!clubs_owner_id_fkey(id, email, status, created_at, chat_blocked)")
    .order("created_at", { ascending: false })
    .limit(2000);

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const rows: AccountRow[] = ((data ?? []) as unknown as Row[])
    .filter((c) => c.profiles)
    .map((c) => {
      const pkg = activePackage(c);
      return {
        userId: c.profiles!.id,
        name: c.name,
        email: c.profiles!.email,
        phone: c.phone,
        status: c.profiles!.status,
        joined: fmt(c.profiles!.created_at, "short"),
        limits: [
          { key: "post" as const, blocked: c.posting_blocked },
          { key: "receive" as const, blocked: c.applications_blocked },
          { key: "clubChat" as const, blocked: c.profiles!.chat_blocked },
        ],
        extra: (pkg ? [plans[pkg].name, `մինչև ${fmt(c.package_ends_at!, "short")}`] : ["Փաթեթ չկա"]) as [string, string?],
        planId: pkg,
        reportItems: cleanReportItems(c.report_items),
        shareBlocked: SHARE_NETWORK_IDS.filter((id) => (c.share_blocked ?? []).includes(id)),
        overrides: pkg ? cleanOverrides(c.plan_overrides) : {},
      };
    })
    .filter((r) => !q || `${r.name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q));

  // Only the super admin gives or takes away a plan.
  const planReports = Object.fromEntries(PACKAGE_IDS.map((id) => [id, { name: plans[id].name, items: cleanReportItems(plans[id].reportItems) ?? REPORT_KEYS }]));
  return <AccountsTable title="Ակումբներ" nameHeader="Ակումբ" extraHeader="Փաթեթ" plans={me.isSuper ? plans : undefined} shareNetworks={await getShareNetworks()} planReports={planReports} rows={rows} />;
}
