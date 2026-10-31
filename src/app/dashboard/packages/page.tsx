import { getPlans } from "@/lib/plans/server";
import { getBusinessSettings } from "@/lib/business";
import PackagesPanel from "@/components/club/PackagesPanel";

export default async function PackagesPage() {
  const [plans, business] = await Promise.all([getPlans(), getBusinessSettings()]);
  return <PackagesPanel plans={plans} days={business.advanced_days} monthLimit={business.listing_limit_month} />;
}
