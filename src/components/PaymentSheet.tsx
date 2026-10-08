"use client";

import { useState } from "react";
import { formatAmd } from "@/lib/catalog";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useT } from "@/i18n/client";

// Shape returned by POST /api/payments/charge (success and decline alike).
export type ChargeResponse = {
  status?: "succeeded" | "declined";
  message?: string | null;
  last4?: string | null;
  payment_id?: string;
  booking?: { id: string };
  tariff?: string;
  package_ends_at?: string;
  email?: string;
  error?: string;
};

// The card form for everything that costs money — a tour sign-up or the
// Advanced tariff. It posts to /api/payments/charge, which runs the mock
// gateway in src/lib/mockPayment.ts: no real money moves, but the flow,
// receipts and emails behave exactly like a real provider would.
export default function PaymentSheet({
  kind,
  amount,
  label,
  tourId,
  tariff,
  submitLabel,
  onCancel,
  onSuccess,
}: {
  kind: "booking" | "subscription";
  amount: number;
  label: string;
  tourId?: string;
  tariff?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSuccess: (data: ChargeResponse) => void;
}) {
  const t = useT();
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          tour_id: tourId,
          tariff,
          card: { number, exp, cvc },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ChargeResponse;
      if (!res.ok) {
        setBusy(false);
        return setError(data.error ? serverErrorMessage(t, data.error) : t("payment.failed"));
      }
      if (data.status === "declined") {
        setBusy(false);
        return setError(data.message ? serverErrorMessage(t, data.message) : t("payment.declined"));
      }
      onSuccess(data);
    } catch {
      setBusy(false);
      setError(t("errors.network"));
    }
  }

  const input = "w-full rounded-lg border border-line bg-surface p-2.5 text-sm text-ink placeholder:text-muted";

  return (
    <form onSubmit={pay} className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <b className="text-sm text-heading">{t("payment.title")}</b>
        <span className="font-semibold text-terracotta-700">{formatAmd(amount)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{label}</p>

      <div className="mt-3 space-y-2">
        <input
          required
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder={t("payment.cardNumber")}
          value={number}
          onChange={(e) =>
            setNumber(
              e.target.value
                .replace(/\D/g, "")
                .slice(0, 19)
                .replace(/(.{4})/g, "$1 ")
                .trim()
            )
          }
          className={input}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            required
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder={t("payment.expiry")}
            value={exp}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
              setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
            }}
            className={input}
          />
          <input
            required
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="CVC"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className={input}
          />
        </div>
      </div>

      <p className="mt-3 rounded-lg bg-sand/60 p-2.5 text-xs leading-5 text-muted">
        {t("payment.testCards", { ok: "4242 4242 4242 4242", declined: "4000 0000 0000 0002", funds: "4000 0000 0000 9995" })}
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-line py-2.5 text-sm font-semibold text-ink hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-full bg-spruce-500 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900 disabled:opacity-50"
        >
          {busy ? t("payment.processing") : submitLabel || t("payment.pay", { amount: formatAmd(amount) })}
        </button>
      </div>
    </form>
  );
}
