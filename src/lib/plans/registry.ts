// What a plan can be given — the single list of plan capabilities.
//
// The values live in the database (packages.config) and are edited by the
// super admin at /admin/plans; nothing here is a plan's actual setting. The
// `default` is only what applies while a plan has no value for a key yet.
// Adding a capability = one entry here plus the code that checks it: the
// admin form picks it up by itself. Safe to import from client components.
import { activePackage, type PackageId } from "@/lib/catalog";

// The admin screens list the capabilities under these headings.
export const PLAN_GROUPS = {
  public: "Ինչ են տեսնում այցելուները",
  tools: "Ակումբի վահանակ և գործիքներ",
  later: "Շուտով (դեռ միայն նշում է)",
} as const;
export type PlanGroup = keyof typeof PLAN_GROUPS;
export const MAX_PLAN_NUMBER = 1000;

export type FeatureDef =
  | { key: string; group: PlanGroup; type: "number"; label: string; help?: string; default: number; min: number }
  | { key: string; group: PlanGroup; type: "boolean"; label: string; help?: string; default: boolean };

const FEATURES = [
  { key: "public_show_rating", group: "public", type: "boolean", label: "Ակումբի վարկանիշը երևում է այցելուներին", default: true },
  { key: "public_show_comments", group: "public", type: "boolean", label: "Մեկնաբանությունները երևում են այցելուներին", default: true },
  { key: "dashboard_monthly_numbers", group: "tools", type: "boolean", label: "Անցած ամսվա թվերը վահանակում", default: true },
  { key: "dashboard_registrants_list", group: "tools", type: "boolean", label: "Գրանցվածների ցանկը վահանակում", default: true },
  { key: "dashboard_comments_tab", group: "tools", type: "boolean", label: "Մեկնաբանությունների բաժինը վահանակում", help: "Ակումբն ինքը տեսնում է իր ստացած մեկնաբանությունները։", default: false },
  { key: "registrants_csv_export", group: "tools", type: "boolean", label: "Գրանցվածների CSV արտահանում", default: false },
  { key: "planner_other_clubs", group: "tools", type: "boolean", label: "Պլանավորիչ (ուրիշ ակումբների արշավները նույն օրը)", default: true },
  { key: "share_buttons", group: "tools", type: "boolean", label: "Տարածման կոճակներ", default: true },
  { key: "monthly_report", group: "later", type: "boolean", label: "Ամսական հաշվետվություն", default: false },
  { key: "analytics", group: "later", type: "boolean", label: "Վերլուծության գործիքներ", default: false },
] as const satisfies readonly FeatureDef[];

// The screens read the general shape, so a number feature can come back.
export const PLAN_FEATURES: readonly FeatureDef[] = FEATURES;

type Feature = (typeof FEATURES)[number];
export type NumberFeature = Extract<Feature, { type: "number" }>["key"];
export type BooleanFeature = Extract<Feature, { type: "boolean" }>["key"];
export type PlanConfig = { [K in NumberFeature]: number } & { [K in BooleanFeature]: boolean };

export type Plan = {
  id: PackageId;
  name: string;
  priceAmd: number; // per month; 0 = free
  isAvailable: boolean; // false = cannot be bought
  isVisible: boolean; // false = frozen: seen only by the super admin
  rank: number; // higher = bigger plan
  config: PlanConfig;
  reportItems: string[] | null; // the monthly report's default lines (null = all); see lib/report/items
};
export type Plans = Record<PackageId, Plan>;

// Stored values laid over the defaults. Missing keys fall back to the
// default, unknown keys and wrong types are ignored.
export function resolveConfig(raw: unknown): PlanConfig {
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, number | boolean> = {};
  for (const f of PLAN_FEATURES) {
    const v = stored[f.key];
    if (f.type === "number") out[f.key] = typeof v === "number" && Number.isFinite(v) ? Math.max(f.min, Math.round(v)) : f.default;
    else out[f.key] = typeof v === "boolean" ? v : f.default;
  }
  return out as PlanConfig;
}

// What the super admin changed for one club (clubs.plan_overrides): only
// known keys with the right type survive.
export type PlanOverrides = Partial<PlanConfig>;
export function cleanOverrides(raw: unknown): PlanOverrides {
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, number | boolean> = {};
  for (const f of PLAN_FEATURES) {
    const v = stored[f.key];
    if (f.type === "number") {
      if (typeof v === "number" && Number.isInteger(v) && v >= f.min && v <= MAX_PLAN_NUMBER) out[f.key] = v;
    } else if (typeof v === "boolean") out[f.key] = v;
  }
  return out as PlanOverrides;
}

// What a club may do right now: its plan (START when no paid plan runs) with
// the club's own changes on top. The database's club_has_feature() agrees.
export type PlanHolder = { tariff: string | null; package_ends_at: string | null; plan_overrides?: unknown };
export function clubConfig(plans: Plans, club: PlanHolder | null | undefined): PlanConfig {
  return { ...plans[activePackage(club)].config, ...cleanOverrides(club?.plan_overrides) };
}

export const can = (config: PlanConfig, key: BooleanFeature): boolean => config[key];
