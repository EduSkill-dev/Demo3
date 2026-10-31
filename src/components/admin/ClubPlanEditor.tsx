"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { PACKAGE_IDS, formatAmd, type PackageId } from "@/lib/catalog";
import { MAX_PLAN_NUMBER, PLAN_FEATURES, PLAN_GROUPS, type PlanGroup, type PlanOverrides, type Plans } from "@/lib/plans/registry";
import Modal from "@/components/ui/Modal";
import { adminAction, adminButton, adminGhost } from "./adminApi";

type Values = Record<string, number | boolean>;

// The pencil next to a club's plan (super admin). The window shows every
// plan side by side, grouped, and a last column with what THIS club gets:
// its plan can be changed, and any single value can differ from the plan —
// e.g. a START club that is given something only PRO has.
export default function ClubPlanEditor({
  userId,
  label,
  current,
  until,
  overrides,
  plans,
}: {
  userId: string;
  label: string;
  current: string | null; // the active plan
  until?: string; // "մինչև …", already formatted
  overrides: PlanOverrides;
  plans: Plans;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tariff, setTariff] = useState<PackageId | null>(current as PackageId | null);
  const [own, setOwn] = useState<Values>(overrides as Values);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base: Values | null = tariff ? plans[tariff].config : null;
  const value = (key: string) => (base ? (key in own ? own[key] : base[key]) : null);
  const differs = (key: string) => !!base && key in own && own[key] !== base[key];
  const changed = PLAN_FEATURES.filter((f) => differs(f.key)).length;
  const hasOwn = Object.keys(overrides).length > 0;

  function show() {
    setTariff(current as PackageId | null);
    setOwn(overrides as Values);
    setError(null);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await adminAction({ action: "club.setPlan", userId, tariff, overrides: tariff ? own : {} });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setOpen(false);
    router.refresh();
  }

  const chip = (active: boolean) =>
    `rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition ${
      active ? "border-spruce-500 bg-spruce-500 text-white" : "border-line bg-surface text-ink hover:border-spruce-500"
    }`;
  const cell = "px-2 py-2 text-center";
  const mark = (v: number | boolean) => (typeof v === "number" ? v : v ? "✓" : "—");

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={`${label}՝ խմբագրել փաթեթը`}
        title={hasOwn ? "Խմբագրել փաթեթը (ունի անհատական կարգավորումներ)" : "Խմբագրել փաթեթը"}
        className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:border-spruce-500 hover:text-ink`}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        {hasOwn && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-apricot-500" aria-hidden="true" />}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Փաթեթ՝ ${label}`}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 whitespace-normal text-left font-normal">
            <span className="text-xs text-muted">
              {error ? <span className="text-sm text-red-600">{error}</span> : changed > 0 ? `Փաթեթից տարբերվող արժեքներ՝ ${changed}` : "Ակումբն ունի ճիշտ այն, ինչ տալիս է փաթեթը։"}
            </span>
            <div className="flex gap-2">
              <button type="button" className={`${adminGhost} !rounded-full !px-4 !py-2 !text-sm`} onClick={() => setOpen(false)}>
                Չեղարկել
              </button>
              <button type="button" disabled={busy} className={adminButton} onClick={save}>
                {busy ? "..." : "Պահպանել"}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5 whitespace-normal text-left">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ակումբի փաթեթը</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" aria-pressed={tariff === null} className={chip(tariff === null)} onClick={() => setTariff(null)}>
                Փաթեթ չկա
              </button>
              {PACKAGE_IDS.map((id) => (
                <button key={id} type="button" aria-pressed={tariff === id} className={chip(tariff === id)} onClick={() => setTariff(id)}>
                  {plans[id].name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs font-normal text-muted">
              {tariff === null
                ? "Առանց փաթեթի ակումբի հայտարարությունները չեն երևում, և նա նորը չի կարող ավելացնել։"
                : tariff === current
                  ? `Փաթեթը գործում է ${until ?? ""}։ Ժամկետը չի փոխվում։`
                  : "Նոր փաթեթը կգործի մեկ ամիս՝ այսօրվանից, առանց վճարման։"}
            </p>
          </section>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] text-[13px] font-normal">
              <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">Ֆունկցիա</th>
                  {PACKAGE_IDS.map((id) => (
                    <th key={id} className={`${cell} font-semibold ${tariff === id ? "bg-sand text-ink" : ""}`}>
                      {plans[id].name}
                      <span className="block text-[10px] font-normal normal-case tracking-normal">
                        {plans[id].priceAmd > 0 ? formatAmd(plans[id].priceAmd) : "անվճար"}
                      </span>
                    </th>
                  ))}
                  <th className={`${cell} border-l border-line font-semibold text-ink`}>Այս ակումբը</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(PLAN_GROUPS) as PlanGroup[]).map((g) => (
                  <Fragment key={g}>
                    <tr className="border-b border-line bg-sand/60">
                      <th colSpan={PACKAGE_IDS.length + 2} className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {PLAN_GROUPS[g]}
                      </th>
                    </tr>
                    {PLAN_FEATURES.filter((f) => f.group === g).map((f) => {
                      const v = value(f.key);
                      return (
                        <tr key={f.key} className="border-b border-line last:border-0">
                          <td className="px-3 py-2 text-ink">{f.label}</td>
                          {PACKAGE_IDS.map((id) => (
                            <td key={id} className={`${cell} text-muted ${tariff === id ? "bg-sand font-semibold text-ink" : ""}`}>
                              {mark((plans[id].config as Record<string, number | boolean>)[f.key])}
                            </td>
                          ))}
                          <td className={`${cell} border-l border-line ${differs(f.key) ? "bg-apricot-500/15" : ""}`}>
                            {v === null ? (
                              <span className="text-muted">—</span>
                            ) : f.type === "number" ? (
                              <input
                                type="number"
                                inputMode="numeric"
                                min={f.min}
                                max={MAX_PLAN_NUMBER}
                                step={1}
                                aria-label={`${f.label}՝ այս ակումբի համար`}
                                value={String(v)}
                                onChange={(e) => setOwn((o) => ({ ...o, [f.key]: Math.max(f.min, Math.min(MAX_PLAN_NUMBER, Math.round(Number(e.target.value) || 0))) }))}
                                className="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-center text-[13px] text-ink focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30"
                              />
                            ) : (
                              <input
                                type="checkbox"
                                aria-label={`${f.label}՝ այս ակումբի համար`}
                                checked={v === true}
                                onChange={(e) => setOwn((o) => ({ ...o, [f.key]: e.target.checked }))}
                                className="h-4 w-4 align-middle accent-spruce-500"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-normal text-muted">
            <span>
              Վերջին սյունակում փոխածը վերաբերում է միայն այս ակումբին (նշվում է գույնով)։ Փաթեթներն իրենք փոխվում են «Փաթեթներ» բաժնում։
            </span>
            {changed > 0 && (
              <button type="button" className={adminGhost} onClick={() => setOwn({})}>
                Վերադարձնել փաթեթի արժեքները
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
