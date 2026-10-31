// What a plan includes, in the words clubs read: the same lines on the club's
// packages page and on the public price list. Which plan has which is never
// written here: it comes from the plan's config (the super admin's switches).
import type { BooleanFeature, PlanConfig } from "./registry";
import type { MessageKey } from "@/i18n/translate";

export const PLAN_LINES: { feature: BooleanFeature | null; label: MessageKey; soon?: boolean }[] = [
  { feature: null, label: "package.listingsMonth" },
  { feature: null, label: "package.participantsOwn" },
  { feature: "public_show_rating", label: "package.ratingsVisible" },
  { feature: "share_buttons", label: "package.shareButtons" },
  { feature: "dashboard_monthly_numbers", label: "package.monthlyNumbers" },
  { feature: "dashboard_comments_tab", label: "package.commentsSection" },
  { feature: "registrants_csv_export", label: "package.csvExport" },
  { feature: "planner_other_clubs", label: "package.planner" },
  { feature: "monthly_report", label: "package.monthlyReport" },
  { feature: "analytics", label: "package.analytics", soon: true },
];

export const planHasLine = (config: PlanConfig, feature: BooleanFeature | null) => (feature ? config[feature] : true);
