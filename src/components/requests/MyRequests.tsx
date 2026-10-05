"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAmd } from "@/lib/catalog";
import type { OfferView, RequestView } from "@/lib/requests";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useFormatDate, useT } from "@/i18n/client";
import RequestSummary from "./RequestSummary";
import { ghostButton, primaryButton, requestAction } from "./api";

export type MyOffer = OfferView & { club: { id: string; name: string; phone: string | null } };
export type MyRequest = { request: RequestView; offers: MyOffer[] };

// The individual's own requests, each with the offers clubs sent. One offer
// can be accepted; that closes the request and opens the club's contacts.
export default function MyRequests({ rows }: { rows: MyRequest[] }) {
  const t = useT();
  const fmt = useFormatDate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: { action: string } & Record<string, unknown>, question: string) {
    if (!confirm(question)) return;
    setBusy(true);
    setError(null);
    const res = await requestAction(body);
    setBusy(false);
    if (res.error !== null) return setError(serverErrorMessage(t, res.error));
    router.refresh();
  }

  const offerStatus = (o: MyOffer) =>
    ({ pending: t("requests.offerPending"), accepted: t("requests.offerAccepted"), declined: t("requests.offerDeclined"), withdrawn: t("requests.offerWithdrawn") })[o.status];

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {rows.map(({ request, offers }) => {
        const shown = offers.filter((o) => o.status !== "withdrawn");
        return (
          <article key={request.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <RequestSummary request={request} />

            <div className="mt-4 border-t border-line pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-serif text-lg font-semibold text-heading">{t("requests.offersTitle", { count: shown.length })}</h3>
                {request.status === "open" && (
                  <button
                    type="button"
                    disabled={busy}
                    className={ghostButton}
                    onClick={() => run({ action: "close", requestId: request.id }, t("requests.confirmClose"))}
                  >
                    {t("requests.close")}
                  </button>
                )}
              </div>

              {shown.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{t("requests.noOffers")}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {shown.map((o) => (
                    <li
                      key={o.id}
                      className={`rounded-xl border p-4 ${o.status === "accepted" ? "border-apricot bg-apricot/5" : "border-line"} ${
                        o.status === "declined" ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/clubs/${o.club.id}`} className="font-semibold text-heading hover:text-apricot-dark">
                            {o.club.name}
                          </Link>
                          <p className="mt-0.5 text-sm text-ink">
                            <span className="font-semibold">{t("common.perPerson", { price: formatAmd(o.price) })}</span> · {fmt(o.date, "long")}
                          </p>
                        </div>
                        {o.status === "pending" && request.status === "open" ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              className={primaryButton}
                              onClick={() => run({ action: "accept", offerId: o.id }, t("requests.confirmAccept", { club: o.club.name }))}
                            >
                              {t("requests.accept")}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className={ghostButton}
                              onClick={() => run({ action: "decline", offerId: o.id }, t("requests.confirmDecline", { club: o.club.name }))}
                            >
                              {t("requests.decline")}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-muted">{offerStatus(o)}</span>
                        )}
                      </div>
                      {o.message && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink">{o.message}</p>}
                      {o.status === "accepted" && (
                        <p className="mt-3 rounded-lg bg-surface p-3 text-sm text-ink">
                          <span className="font-semibold">{t("requests.clubContact")}</span>{" "}
                          {o.club.phone ? (
                            <a href={`tel:${o.club.phone.replace(/\s/g, "")}`} className="text-apricot hover:underline">{o.club.phone}</a>
                          ) : (
                            <Link href={`/clubs/${o.club.id}`} className="text-apricot hover:underline">{o.club.name}</Link>
                          )}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
