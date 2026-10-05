import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { getFormatDate } from "@/i18n/server";
import { PACKAGES, activePackage } from "@/lib/catalog";
import type { AccountStatus } from "@/lib/adminLabels";
import AccountsTable, { type AccountRow } from "@/components/admin/AccountsTable";

type Row = {
  name: string;
  phone: string | null;
  tariff: string | null;
  package_ends_at: string | null;
  posting_blocked: boolean;
  applications_blocked: boolean;
  profiles: { id: string; email: string; status: AccountStatus; created_at: string } | null;
};

export default async function AdminClubsPage({ searchParams }: { searchParams: { q?: string } }) {
  const me = await getAdmin();
  if (!me || !can(me, "clubs")) redirect("/admin");

  const fmt = await getFormatDate();
  const { data } = await createAdminClient()
    .from("clubs")
    .select("name, phone, tariff, package_ends_at, posting_blocked, applications_blocked, profiles!clubs_owner_id_fkey(id, email, status, created_at)")
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
        ],
        extra: (pkg ? [PACKAGES[pkg].name, `մինչև ${fmt(c.package_ends_at!, "short")}`] : ["Փաթեթ չկա"]) as [string, string?],
      };
    })
    .filter((r) => !q || `${r.name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q));

  return <AccountsTable title="Ակումբներ" nameHeader="Ակումբ" extraHeader="Փաթեթ" rows={rows} />;
}
