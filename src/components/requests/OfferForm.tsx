"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmd } from "@/lib/catalog";
import type { OfferView } from "@/lib/requests";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useFormatDate, useT } from "@/i18n/client";
import { fieldClass, ghostButton, labelClass, primaryButton, requestAction } from "./api";

// A club's answer to one request: price per person, a date and a few words.
// Shows the club's current offer when there is one; a pending offer can be
// edited or withdrawn.
export default function OfferForm({
  requestId,
  mine,
  defaultDate,
  canOffer,
}: {
  requestId: string;
  mine: OfferView | null;
  defaultDate: string;
  canOffer: boolean; // false: no active package
}) {
  const t = useT();
  const fmt = useFormatDate();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(mine ? String(mine.price) : "");
  const [date, setDate] = useState(mine?.date ?? (defaultDate >= today ? defaultDate : today));
  const [message, setMessage] = useState(mine?.message ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: { action: string } & Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await requestAction(body);
    setBusy(false);
    if (res.error !== null) return setError(serverErrorMessage(t, res.error));
    setOpen(false);
    router.refresh();
  }

  const statusText = mine
    ? { pending: t("requests.offerPending"), accepted: t("requests.offerAccepted"), declined: t("requests.offerDeclined"), withdrawn: t("requests.offerWithdrawn") }[mine.status]
    : null;
  const active = mine && (mine.status === "pending" || mine.status === "accepted");

  return (
    <div className="border-t border-line pt-3">
      {active && !open && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink">
            <span className="font-semibold">{t("requests.yourOffer")}</span>{" "}
            {t("common.perPerson", { price: formatAmd(mine.price) })} · {fmt(mine.date, "short")} ·{" "}
            <span className="text-muted">{statusText}</span>
          </p>
          {mine.status === "pending" && (
            <div className="flex gap-2">
              <button type="button" disabled={busy} className={ghostButton} onClick={() => setOpen(true)}>
                {t("common.edit")}
              </button>
              <button
                type="button"
                disabled={busy}
                className={ghostButton}
                onClick={() => confirm(t("requests.confirmWithdraw")) && run({ action: "withdraw", offerId: mine.id })}
              >
                {t("requests.withdraw")}
              </button>
            </div>
          )}
        </div>
      )}

      {!active && !open && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={!canOffer} className={primaryButton} onClick={() => setOpen(true)}>
            {t("requests.sendOffer")}
          </button>
          {!canOffer && <span className="text-xs text-muted">{t("requests.needPackage")}</span>}
          {statusText && <span className="text-xs text-muted">{statusText}</span>}
        </div>
      )}

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run({ action: "offer", requestId, price: Number(price), date, message });
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`of-price-${requestId}`} className={labelClass}>{t("requests.offerPrice")}</label>
              <input id={`of-price-${requestId}`} required type="number" min={0} step={100} value={price} onChange={(e) => setPrice(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor={`of-date-${requestId}`} className={labelClass}>{t("requests.offerDate")}</label>
              <input id={`of-date-${requestId}`} required type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
            </div>
          </div>
          <div>
            <label htmlFor={`of-msg-${requestId}`} className={labelClass}>{t("requests.offerMessage")}</label>
            <textarea id={`of-msg-${requestId}`} rows={3} maxLength={2000} placeholder={t("requests.offerMessageHint")} value={message} onChange={(e) => setMessage(e.target.value)} className={fieldClass} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={primaryButton}>
              {busy ? "..." : t("requests.sendOffer")}
            </button>
            <button type="button" className={ghostButton} onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
