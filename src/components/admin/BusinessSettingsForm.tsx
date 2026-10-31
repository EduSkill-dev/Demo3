"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessSettings } from "@/lib/business";
import { adminAction, adminButton, adminInput } from "./adminApi";

const NUMBERS: { key: Exclude<keyof BusinessSettings, "fee_includes_bank_fee">; label: string }[] = [
  { key: "listing_limit_month", label: "Հրապարակումներ մեկ ամսվա համար" },
  { key: "listing_limit_active", label: "Միաժամանակ հրապարակված" },
  { key: "platform_fee_percent", label: "Հարթակի միջնորդավճար (%)" },
  { key: "promo_days", label: "Անվճար ժամանակահատված գրանցումից (օր)" },
  { key: "advanced_days", label: "Advanced-ի մեկ վճարումը (օր)" },
  { key: "advanced_reminder_days", label: "Advanced-ի հիշեցում ավարտից (օր առաջ)" },
];

// The numbers the business runs on (super admin): the database and the site
// read them from here, none of them is written in code.
export default function BusinessSettingsForm({ initial }: { initial: BusinessSettings }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await adminAction({ action: "business.save", values });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-line bg-surface p-5">
      <h3 className="font-serif text-lg font-semibold text-heading">Հարթակի թվեր</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {NUMBERS.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="mb-1 block text-ink">{f.label}</span>
            <input
              type="number"
              min={0}
              step={f.key === "platform_fee_percent" ? 0.1 : 1}
              required
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
              className={adminInput}
            />
          </label>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={values.fee_includes_bank_fee} onChange={(e) => setValues((v) => ({ ...v, fee_includes_bank_fee: e.target.checked }))} className="h-4 w-4 accent-spruce-500" />
        Միջնորդավճարը ներառում է բանկի միջնորդավճարը
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={busy} className={adminButton}>{busy ? "…" : "Պահպանել"}</button>
        {saved && <span className="text-sm text-green-700 dark:text-green-400">✓ Պահպանված է</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
