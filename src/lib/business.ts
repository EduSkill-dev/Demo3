// Server-only: the numbers the business runs on (site_settings "business"),
// edited by the super admin at /admin/plans. Read once per request, so a
// change applies on the next page load. The database reads the same row for
// the rules it enforces itself (see 0084_business_model.sql).
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type BusinessSettings = {
  listing_limit_month: number; // listings published for one calendar month
  listing_limit_active: number; // published and not yet over, at the same time
  platform_fee_percent: number; // the commission on a booking
  fee_includes_bank_fee: boolean; // the commission already covers the bank's fee
  promo_days: number; // days from a club's sign-up with no commission
  advanced_days: number; // what one Advanced payment buys
  advanced_reminder_days: number; // the reminder before Advanced ends
};

export const BUSINESS_DEFAULTS: BusinessSettings = {
  listing_limit_month: 30,
  listing_limit_active: 30,
  platform_fee_percent: 5,
  fee_includes_bank_fee: true,
  promo_days: 90,
  advanced_days: 30,
  advanced_reminder_days: 3,
};

export const getBusinessSettings = cache(async (): Promise<BusinessSettings> => {
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "business").maybeSingle();
  return { ...BUSINESS_DEFAULTS, ...(((data as { value?: Partial<BusinessSettings> } | null)?.value ?? {}) as Partial<BusinessSettings>) };
});
