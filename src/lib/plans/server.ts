// Server-only: the plans as the super admin set them. Read once per request
// (React.cache) and never kept longer, so a change at /admin/plans applies
// on the next page load.
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PACKAGE_IDS, isPackageId, type PackageId } from "@/lib/catalog";
import { clubConfig, resolveConfig, type Plan, type PlanConfig, type PlanHolder, type Plans } from "./registry";

type Row = { id: string; name: string; price_amd: number; is_available: boolean; is_visible: boolean; sort: number; config: unknown; report_items: string[] | null };

export const getPlans = cache(async (): Promise<Plans> => {
  const { data } = await createAdminClient().from("packages").select("id, name, price_amd, is_available, is_visible, sort, config, report_items");
  const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
  return Object.fromEntries(
    PACKAGE_IDS.map((id, i): [PackageId, Plan] => {
      const r = rows.get(id);
      return [
        id,
        {
          id,
          name: r?.name ?? id,
          priceAmd: r?.price_amd ?? 0,
          isAvailable: r?.is_available ?? false,
          isVisible: r?.is_visible ?? false,
          rank: r?.sort ?? i + 1,
          config: resolveConfig(r?.config),
          reportItems: r?.report_items ?? null,
        },
      ];
    })
  ) as Plans;
});

// What a club may do right now (see clubConfig). Pass the club row with its
// plan_overrides, or the club's own changes are not counted.
export async function planConfigOf(club: PlanHolder | null | undefined): Promise<PlanConfig> {
  return clubConfig(await getPlans(), club);
}

export async function getClubPlanConfig(clubId: string): Promise<PlanConfig> {
  const { data } = await createAdminClient().from("clubs").select("tariff, package_ends_at, plan_overrides").eq("id", clubId).maybeSingle();
  return planConfigOf(data as PlanHolder | null);
}

export async function planName(id: string | null | undefined): Promise<string> {
  return isPackageId(id) ? (await getPlans())[id].name : "—";
}
