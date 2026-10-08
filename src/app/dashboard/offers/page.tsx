import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/viewer";
import { getT } from "@/i18n/server";
import { getSightNames } from "@/lib/sights";
import { activePackage } from "@/lib/catalog";
import { REQUEST_COLUMNS, toOfferView, toRequestView, type OfferRow, type RequestRow } from "@/lib/requests";
import RequestSummary from "@/components/requests/RequestSummary";
import OfferForm from "@/components/requests/OfferForm";

type Raw = OfferRow & { tour_requests: (RequestRow & { user_id: string }) | null };

// The club's own offers to custom requests. Once the author accepts one, the
// club sees who to call.
export default async function ClubOffersPage() {
  const viewer = await getViewer();
  if (!viewer?.club) redirect("/login?next=/dashboard/offers");

  const [t, sightNames] = await Promise.all([getT(), getSightNames()]);
  const db = createAdminClient();
  const [{ data }, { data: clubRow }] = await Promise.all([
    db
      .from("tour_offers")
      .select(`id, price, date, message, status, created_at, tour_requests(${REQUEST_COLUMNS}, user_id)`)
      .eq("club_id", viewer.club.id)
      .order("created_at", { ascending: false }),
    db.from("clubs").select("tariff, package_ends_at").eq("id", viewer.club.id).single(),
  ]);
  const rows = ((data ?? []) as unknown as Raw[]).filter((o) => o.tour_requests);
  const canOffer = !!activePackage(clubRow as { tariff: string | null; package_ends_at: string | null });

  // Contacts only of the people who accepted this club's offer.
  const acceptedIds = rows.filter((o) => o.status === "accepted").map((o) => o.tour_requests!.user_id);
  const { data: people } = acceptedIds.length
    ? await db.from("profiles").select("id, first_name, last_name, phone, email").in("id", acceptedIds)
    : { data: [] };
  const contact = new Map(
    ((people ?? []) as { id: string; first_name: string | null; last_name: string | null; phone: string | null; email: string }[]).map((p) => [p.id, p])
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">{t("requests.myOffersIntro")}</p>
        <Link href="/requests" className="rounded-full bg-spruce-500 px-4 py-2 text-sm font-semibold text-white hover:bg-spruce-900">
          {t("requests.browse")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("requests.myOffersEmpty")}</p>
      ) : (
        <ul className="space-y-5">
          {rows.map((o) => {
            const request = toRequestView(o.tour_requests!, sightNames);
            const person = o.status === "accepted" ? contact.get(o.tour_requests!.user_id) : null;
            return (
              <li
                key={o.id}
                className={`space-y-4 rounded-2xl border bg-surface p-5 shadow-sm ${o.status === "accepted" ? "border-terracotta-500" : "border-line"}`}
              >
                <RequestSummary request={request} showAuthor />
                {person && (
                  <div className="rounded-xl bg-terracotta-500/10 p-4 text-sm text-ink">
                    <p className="font-semibold text-heading">{t("requests.contacts")}</p>
                    <p className="mt-1">
                      {[person.first_name, person.last_name].filter(Boolean).join(" ") || "—"}
                      {person.phone && (
                        <>
                          {" · "}
                          <a href={`tel:${person.phone.replace(/\s/g, "")}`} className="text-terracotta-500 hover:underline">{person.phone}</a>
                        </>
                      )}
                      {" · "}
                      <a href={`mailto:${person.email}`} className="text-terracotta-500 hover:underline">{person.email}</a>
                    </p>
                  </div>
                )}
                <OfferForm
                  requestId={request.id}
                  mine={toOfferView(o)}
                  defaultDate={o.date}
                  canOffer={canOffer && request.status === "open"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
