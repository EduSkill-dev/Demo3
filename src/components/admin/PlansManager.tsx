"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PACKAGE_IDS } from "@/lib/catalog";
import { MAX_PLAN_NUMBER, PLAN_FEATURES, PLAN_GROUPS, type Plan, type PlanGroup, type Plans } from "@/lib/plans/registry";
import { adminAction, adminButton, adminInput } from "./adminApi";

// One card per plan. The fields are built from PLAN_FEATURES, so a capability
// added to the registry shows up here by itself.
export default function PlansManager({ plans, clubCounts }: { plans: Plans; clubCounts: Record<string, number> }) {
  return (
    <div>
      <h2 className="font-serif text-xl font-semibold text-heading">Փաթեթներ</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Այստեղ նշվածն է որոշում, թե ինչ կարող է անել յուրաքանչյուր փաթեթի ակումբը։ Փոփոխությունն ուժի մեջ է մտնում
        պահպանելուց անմիջապես հետո՝ տվյալ փաթեթն ունեցող բոլոր ակումբների համար։
      </p>
      <div className="mt-5 grid items-start gap-4 xl:grid-cols-3">
        {PACKAGE_IDS.map((id) => (
          <PlanCard key={id} plan={plans[id]} clubs={clubCounts[id] ?? 0} />
        ))}
      </div>
    </div>
  );
}

const heading = "text-[11px] font-semibold uppercase tracking-wide text-muted";

function PlanCard({ plan, clubs }: { plan: Plan; clubs: number }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(plan.priceAmd));
  const [available, setAvailable] = useState(plan.isAvailable);
  const [config, setConfig] = useState<Record<string, number | boolean>>({ ...plan.config });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const touch = () => {
    setSaved(false);
    setError(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await adminAction({ action: "plan.save", id: plan.id, priceAmd: Number(price), isAvailable: available, config });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-lg font-semibold text-heading">{plan.name}</h3>
        <span className="whitespace-nowrap text-xs text-muted">Ակտիվ ակումբներ՝ {clubs}</span>
      </div>

      <section className="mt-4 space-y-3">
        <h4 className={heading}>Գին և հասանելիություն</h4>
        <div>
          <label htmlFor={`${plan.id}-price`} className="mb-1 block text-sm font-medium text-ink">Ամսական գին (֏)</label>
          <input
            id={`${plan.id}-price`}
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            required
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              touch();
            }}
            className={adminInput}
          />
          <p className="mt-1 text-xs text-muted">0՝ անվճար։ Գինը՝ 100-ի բազմապատիկ։</p>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => {
              setAvailable(e.target.checked);
              touch();
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-spruce-500"
          />
          <span>
            Հասանելի է ընտրության համար
            <span className="block text-xs text-muted">Անջատված՝ ակումբները տեսնում են «Շուտով» և չեն կարող ընտրել։</span>
          </span>
        </label>
      </section>

      {(Object.keys(PLAN_GROUPS) as PlanGroup[]).map((g) => (
        <section key={g} className="mt-4 space-y-2.5 border-t border-line pt-4">
          <h4 className={heading}>{PLAN_GROUPS[g]}</h4>
          {PLAN_FEATURES.filter((f) => f.group === g).map((f) =>
            f.type === "number" ? (
              <div key={f.key}>
                <label htmlFor={`${plan.id}-${f.key}`} className="mb-1 block text-sm font-medium text-ink">{f.label}</label>
                <input
                  id={`${plan.id}-${f.key}`}
                  type="number"
                  inputMode="numeric"
                  min={f.min}
                  max={MAX_PLAN_NUMBER}
                  step={1}
                  required
                  value={String(config[f.key])}
                  onChange={(e) => {
                    setConfig((c) => ({ ...c, [f.key]: e.target.value === "" ? 0 : Number(e.target.value) }));
                    touch();
                  }}
                  className={adminInput}
                />
                {"help" in f && <p className="mt-1 text-xs text-muted">{f.help}</p>}
              </div>
            ) : (
              <label key={f.key} className="flex items-start gap-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={config[f.key] === true}
                  onChange={(e) => {
                    setConfig((c) => ({ ...c, [f.key]: e.target.checked }));
                    touch();
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-spruce-500"
                />
                <span>
                  {f.label}
                  {"help" in f && <span className="block text-xs text-muted">{f.help}</span>}
                </span>
              </label>
            )
          )}
        </section>
      ))}

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={busy} className={adminButton}>
          {busy ? "..." : "Պահպանել"}
        </button>
        {saved && <span className="text-sm font-medium text-green-700 dark:text-green-400">Պահպանված է</span>}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
