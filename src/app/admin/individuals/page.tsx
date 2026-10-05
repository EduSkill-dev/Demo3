import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { getFormatDate } from "@/i18n/server";
import type { AccountStatus } from "@/lib/adminLabels";
import AccountsTable, { type AccountRow } from "@/components/admin/AccountsTable";

export default async function AdminIndividualsPage({ searchParams }: { searchParams: { q?: string } }) {
  const me = await getAdmin();
  if (!me || !can(me, "individuals")) redirect("/admin");

  const fmt = await getFormatDate();
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, first_name, last_name, email, phone, status, created_at")
    .eq("role", "individual")
    .order("created_at", { ascending: false })
    .limit(2000);

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const rows: AccountRow[] = ((data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    status: AccountStatus;
    created_at: string;
  }[])
    .map((p) => ({
      userId: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" "),
      email: p.email,
      phone: p.phone,
      status: p.status,
      joined: fmt(p.created_at, "short"),
    }))
    .filter((r) => !q || `${r.name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q));

  return <AccountsTable title="Անհատներ" nameHeader="Անուն" rows={rows} />;
}
