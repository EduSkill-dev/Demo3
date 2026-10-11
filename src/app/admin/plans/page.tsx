import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdmin } from "@/lib/admin";
import { activePackage } from "@/lib/catalog";
import { getPlans } from "@/lib/plans/server";
import PlansManager from "@/components/admin/PlansManager";

// Super admin only: what each plan costs and allows. Nothing about a plan is
// written in code — the site reads these values on every request.
export default async function AdminPlansPage() {
  const me = await getAdmin();
  if (!me?.isSuper) redirect("/admin");

  const { data } = await createAdminClient().from("clubs").select("tariff, package_ends_at").not("tariff", "is", null).limit(5000);
  const clubCounts: Record<string, number> = {};
  for (const c of (data ?? []) as { tariff: string | null; package_ends_at: string | null }[]) {
    const id = activePackage(c);
    if (id) clubCounts[id] = (clubCounts[id] ?? 0) + 1;
  }

  return <PlansManager plans={await getPlans()} clubCounts={clubCounts} />;
}
