import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/viewer";
import { getT } from "@/i18n/server";
import { getSightNames } from "@/lib/sights";
import { activePackage } from "@/lib/catalog";
import { REQUEST_COLUMNS, toOfferView, toRequestView, type OfferRow, type RequestRow } from "@/lib/requests";
import RequestSummary from "@/components/requests/RequestSummary";
import OfferForm from "@/components/requests/OfferForm";

export const metadata: Metadata = { title: { absolute: "Culmen" }, robots: { index: false } };

// Custom tour requests, newest first. Only clubs (and admins) see this page:
// visitors are sent to log in, individuals to their own requests.
export default async function RequestsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/requests");
  if (viewer.role === "individual") redirect("/account/requests");

  const [t, sightNames] = await Promise.all([getT(), getSightNames()]);
  const db = createAdminClient();
  const { data } = await db
    .from("tour_requests")
    .select(REQUEST_COLUMNS)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(200);
  const requests = ((data ?? []) as RequestRow[]).map((r) => toRequestView(r, sightNames));

  // The club's own answers to these requests, and whether it may answer at all.
  const club = viewer.club;
  const [{ data: offerRows }, { data: clubRow }] = await Promise.all([
    club && requests.length
      ? db.from("tour_offers").select("id, request_id, price, date, message, status, created_at").eq("club_id", club.id).in("request_id", requests.map((r) => r.id))
      : Promise.resolve({ data: [] }),
    club ? db.from("clubs").select("tariff, package_ends_at").eq("id", club.id).single() : Promise.resolve({ data: null }),
  ]);
  const mine = new Map(((offerRows ?? []) as (OfferRow & { request_id: string })[]).map((o) => [o.request_id, toOfferView(o)]));
  const canOffer = !!clubRow && !!activePackage(clubRow as { tariff: string | null; package_ends_at: string | null });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-center font-serif text-3xl font-semibold text-heading">{t("requests.title")}</h1>
      <p className="mx-auto mt-2 max-w-2xl text-center text-muted">{t("requests.intro")}</p>

      {requests.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center text-muted">{t("requests.empty")}</p>
      ) : (
        <ul className="mt-8 space-y-5">
          {requests.map((r) => (
            <li key={r.id} className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <RequestSummary request={r} showAuthor />
              {club && <OfferForm requestId={r.id} mine={mine.get(r.id) ?? null} defaultDate={r.dateFrom} canOffer={canOffer} />}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
