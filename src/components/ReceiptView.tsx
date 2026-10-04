"use client";

import { useFormatDate, useT } from "@/i18n/client";
import { formatAmd } from "@/lib/catalog";

export type ReceiptPayment = {
  id: string;
  created_at: string;
  amount: number | string;
  currency: string;
  card_last4: string | null;
  period_start: string | null;
  period_end: string | null;
};

// The body of a receipt — shown in a modal from the club's package history
// and from an individual's tour history.
export default function ReceiptView({
  payment,
  item,
  payer,
}: {
  payment: ReceiptPayment;
  item: string; // "Advanced փաթեթ" or the tour title
  payer: string;
}) {
  const t = useT();
  const fmt = useFormatDate();
  const day = (iso: string) => fmt(iso, "long");

  const rows: [string, string][] = [
    [t("receipt.number"), payment.id.slice(0, 8).toUpperCase()],
    [t("receipt.date"), day(payment.created_at)],
    [t("receipt.payer"), payer],
    [t("receipt.item"), item],
    ...(payment.period_start && payment.period_end
      ? ([[t("receipt.period"), `${day(payment.period_start)} – ${day(payment.period_end)}`]] as [string, string][])
      : []),
    [t("receipt.amount"), Number(payment.amount) > 0 ? formatAmd(payment.amount) : t("common.free")],
    ...(payment.card_last4 ? ([[t("receipt.card"), `•••• ${payment.card_last4}`]] as [string, string][]) : []),
    [t("receipt.status"), t("receipt.paid")],
  ];

  return (
    <div className="text-sm">
      <p className="font-serif text-xl font-semibold text-heading">🏔️ Highland</p>
      <dl className="mt-4 divide-y divide-line rounded-xl border border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
