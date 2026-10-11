import { getPlans } from "@/lib/plans/server";
import PackagesPanel from "@/components/club/PackagesPanel";

export default async function PackagesPage() {
  return <PackagesPanel plans={await getPlans()} />;
}
