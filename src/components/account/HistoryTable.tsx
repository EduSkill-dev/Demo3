"use client";

import { useState } from "react";
import { useIntlLocale, useT } from "@/i18n/client";
import Modal from "@/components/ui/Modal";
import TourDetails, { type TourForDetails } from "@/components/tour/TourDetails";
import ReceiptView, { type ReceiptPayment } from "@/components/ReceiptView";
import ReceiptDownload from "@/components/ui/ReceiptDownload";

export type HistoryRow = { bookingId: string; tour: TourForDetails; receipt: ReceiptPayment | null };

// Finished hikes: name, date, receipt, region, View.
export default function HistoryTable({ rows, payer }: { rows: HistoryRow[]; payer: string }) {
  const t = useT();
  const intl = useIntlLocale();
  const [tour, setTour] = useState<HistoryRow | null>(null);
  const [receipt, setReceipt] = useState<HistoryRow | null>(null);

  if (rows.length === 0) {
    return <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("account.historyEmpty")}</p>;
  }
  const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(intl, { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">{t("account.colTour")}</th>
              <th className="px-4 py-3">{t("account.colDate")}</th>
              <th className="px-4 py-3">{t("account.colReceipt")}</th>
              <th className="px-4 py-3">{t("account.colRegion")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bookingId} className="border-b border-line last:border-0 text-ink">
                <td className="px-4 py-3">
                  <span className="font-medium">{r.tour.title}</span>
                  {r.tour.club && <span className="block text-xs text-muted">{r.tour.club.name}</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3">{day(r.tour.date)}</td>
                <td className="px-4 py-3">
                  {r.receipt ? (
                    <button type="button" onClick={() => setReceipt(r)} className="font-semibold text-apricot hover:text-apricot-dark">
                      🧾 {t("common.view")}
                    </button>
                  ) : (
                    <span className="text-muted">{t("common.free")}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{r.tour.regions.map((x) => t(`region.${x}`)).join(", ")}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setTour(r)} className="font-semibold text-apricot hover:text-apricot-dark">
                    {t("common.view")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!tour} onClose={() => setTour(null)} title={tour?.tour.title ?? ""} size="lg">
        {tour && <TourDetails tour={tour.tour} />}
      </Modal>
      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title={t("receipt.title")}
        actions={receipt?.receipt ? <ReceiptDownload paymentId={receipt.receipt.id} /> : null}
      >
        {receipt?.receipt && <ReceiptView payment={receipt.receipt} item={receipt.tour.title} payer={payer} />}
      </Modal>
    </>
  );
}
