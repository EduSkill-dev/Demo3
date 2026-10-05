import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { getT } from "@/i18n/server";
import { getSightNames } from "@/lib/sights";
import { MAX_OPEN_REQUESTS, REQUEST_COLUMNS, toOfferView, toRequestView, type OfferRow, type RequestRow } from "@/lib/requests";
import MyRequests, { type MyRequest } from "@/components/requests/MyRequests";

type Raw = RequestRow & {
  tour_offers: (OfferRow & { clubs: { id: string; name: string; phone: string | null } | null })[];
};

// "My requests": what the individual asked for and what the clubs offered.
export default async function AccountRequestsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/requests");

  const [t, sightNames] = await Promise.all([getT(), getSightNames()]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("tour_requests")
    .select(`${REQUEST_COLUMNS}, tour_offers(id, price, date, message, status, created_at, clubs(id, name, phone))`)
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false });

  const rows: MyRequest[] = ((data ?? []) as unknown as Raw[]).map((r) => ({
    request: toRequestView(r, sightNames),
    offers: (r.tour_offers ?? [])
      .filter((o) => o.clubs)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((o) => ({ ...toOfferView(o), club: o.clubs! })),
  }));
  const open = rows.filter((r) => r.request.status === "open").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">{t("requests.myIntro")}</p>
        {open < MAX_OPEN_REQUESTS ? (
          <Link href="/account/requests/new" className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark">
            {t("requests.newButton")}
          </Link>
        ) : (
          <span className="text-xs text-muted">{t("requests.limitReached", { max: MAX_OPEN_REQUESTS })}</span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("requests.myEmpty")}</p>
      ) : (
        <MyRequests rows={rows} />
      )}
    </div>
  );
}
