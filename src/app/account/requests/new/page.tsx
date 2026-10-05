import { getT } from "@/i18n/server";
import { getSightOptions } from "@/lib/sights";
import RequestForm from "@/components/requests/RequestForm";

export default async function NewRequestPage() {
  const [t, sights] = await Promise.all([getT(), getSightOptions()]);
  return (
    <div>
      <h2 className="mb-4 font-serif text-xl font-semibold text-heading">{t("requests.newTitle")}</h2>
      <RequestForm sights={sights} />
    </div>
  );
}
