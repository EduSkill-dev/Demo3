"use client";

import { useState } from "react";
import { formatAmd } from "@/types/database";

// Shape returned by POST /api/payments/charge (success and decline alike).
export type ChargeResponse = {
  status?: "succeeded" | "declined";
  message?: string | null;
  last4?: string | null;
  payment_id?: string;
  booking?: { id: string };
  tariff?: string;
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
        return setError(data.error || "Չստացվեց վճարումը։ Փորձիր նորից։");
      }
      if (data.status === "declined") {
        setBusy(false);
        return setError(data.message || "Վճարումը մերժվեց։");
      }
      onSuccess(data);
    } catch {
      setBusy(false);
      setError("Սերվերին կապվել չստացվեց։ Փորձիր նորից։");
    }
  }

  const input = "w-full rounded-lg border border-neutral-300 p-2.5 text-sm";

  return (
    <form onSubmit={pay} className="rounded-2xl border border-sand bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <b className="text-sm text-pine">Թեստային վճարում</b>
        <span className="font-semibold text-apricot-dark">{formatAmd(amount)}</span>
      </div>
      <p className="mt-1 text-xs text-neutral-400">{label}</p>

      <div className="mt-3 space-y-2">
        <input
          required
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="Քարտի համար"
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
            placeholder="Ժամկետ՝ 12/28"
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

      <p className="mt-3 rounded-lg bg-stone p-2.5 text-xs leading-5 text-neutral-500">
        Թեստային քարտեր՝ <b>4242 4242 4242 4242</b> — հաջող,
        <b> 4000 0000 0000 0002</b> — մերժում,
        <b> 4000 0000 0000 9995</b> — անբավարար միջոց։ Իրական գումար չի գանձվում։
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            Չեղարկել
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-lg bg-apricot py-2.5 text-sm font-semibold text-white hover:bg-apricot-dark disabled:opacity-50"
        >
          {busy ? "Մշակվում է..." : submitLabel || `Վճարել ${formatAmd(amount)}`}
        </button>
      </div>
    </form>
  );
}
