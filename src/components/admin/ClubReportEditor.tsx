"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { REPORT_GROUPS, REPORT_ITEMS, REPORT_KEYS, type ReportGroup, type ReportItem } from "@/lib/report/items";
import Modal from "@/components/ui/Modal";
import { adminAction, adminButton, adminGhost } from "./adminApi";

type PlanReports = Record<string, { name: string; items: ReportItem[] }>;

// The "Հաշվետվություն" chip in a club's row. Like the plan window: every
// plan's report lines side by side (which plan has what), and a last column
// with what THIS club sees. Without changes the club follows its plan;
// "reset" brings it back to that.
export default function ClubReportEditor({
  userId,
  label,
  planId,
  planReports,
  clubItems,
}: {
  userId: string;
  label: string;
  planId: string; // the club's active plan
  planReports: PlanReports; // every plan's default lines, in plan order
  clubItems: ReportItem[] | null; // null = follows the plan
}) {
  const router = useRouter();
  const planItems = planReports[planId]?.items ?? REPORT_KEYS;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReportItem[]>(clubItems ?? planItems);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const own = clubItems !== null;
  const asPlan = items.length === planItems.length && items.every((k) => planItems.includes(k));
  const changed = REPORT_KEYS.filter((k) => planItems.includes(k) !== items.includes(k)).length;
  const plans = Object.entries(planReports);

  async function save(next: ReportItem[] | null) {
    setBusy(true);
    setError(null);
    const res = await adminAction({ action: "club.setReport", userId, items: next });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setOpen(false);
    router.refresh();
  }

  const cell = "px-2 py-2 text-center";

  return (
    <>
      <button
        type="button"
        title={own ? "Հաշվետվության տողերը փոխված են այս ակումբի համար" : `Հաշվետվությունը՝ ըստ ${planReports[planId]?.name ?? ""} փաթեթի`}
        onClick={() => {
          setItems(clubItems ?? planItems);
          setError(null);
          setOpen(true);
        }}
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          own ? "border-apricot-500 bg-apricot-100 text-apricot-700" : "border-line bg-surface text-ink hover:border-spruce-500"
        }`}
      >
        Հաշվետվություն
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Հաշվետվություն՝ ${label}`}
        size="lg"
        footer={
          <div className="flex flex-col gap-2 whitespace-normal text-left font-normal sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted">
              {error ? <span className="text-sm text-red-600">{error}</span> : changed > 0 ? `Փաթեթից տարբերվող տողեր՝ ${changed}` : "Ակումբը տեսնում է ճիշտ այն, ինչ տալիս է փաթեթը։"}
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy || (!own && asPlan)} className={`${adminGhost} !rounded-full !px-4 !py-2 !text-sm w-full sm:w-auto`} onClick={() => (own ? save(null) : setItems(planItems))}>
                Վերադարձնել փաթեթի լռելյայնը
              </button>
              <button type="button" className={`${adminGhost} !rounded-full !px-4 !py-2 !text-sm`} onClick={() => setOpen(false)}>
                Չեղարկել
              </button>
              <button type="button" disabled={busy} className={adminButton} onClick={() => save(asPlan ? null : REPORT_KEYS.filter((k) => items.includes(k)))}>
                {busy ? "..." : "Պահպանել"}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 whitespace-normal text-left font-normal">
          <p className="text-sm text-muted">
            Ձախում՝ ինչ է ներառում յուրաքանչյուր փաթեթի հաշվետվությունը, վերջին սյունակում՝ ինչ է տեսնում այս ակումբը։ Փոխածը վերաբերում է միայն
            այս ակումբին․ փաթեթների լռելյայն կազմը փոխվում է «Փաթեթներ» բաժնում։
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">Տող</th>
                  {plans.map(([id, p]) => (
                    <th key={id} className={`${cell} font-semibold ${id === planId ? "bg-sand text-ink" : ""}`}>{p.name}</th>
                  ))}
                  <th className={`${cell} border-l border-line font-semibold text-ink`}>Այս ակումբը</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(REPORT_GROUPS) as ReportGroup[]).map((g) => (
                  <Fragment key={g}>
                    <tr className="border-b border-line bg-sand/60">
                      <th colSpan={plans.length + 2} className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {REPORT_GROUPS[g]}
                      </th>
                    </tr>
                    {REPORT_ITEMS.filter((i) => i.group === g).map((i) => {
                      const differs = planItems.includes(i.key) !== items.includes(i.key);
                      return (
                        <tr key={i.key} className="border-b border-line last:border-0">
                          <td className="px-3 py-2 text-ink">{i.label}</td>
                          {plans.map(([id, p]) => (
                            <td key={id} className={`${cell} ${id === planId ? "bg-sand font-semibold text-ink" : "text-muted"}`}>
                              {p.items.includes(i.key) ? "✓" : "—"}
                            </td>
                          ))}
                          <td className={`${cell} border-l border-line ${differs ? "bg-apricot-500/15" : ""}`}>
                            <input
                              type="checkbox"
                              aria-label={`${i.label}՝ այս ակումբի համար`}
                              checked={items.includes(i.key)}
                              onChange={(e) => setItems((cur) => (e.target.checked ? [...cur, i.key] : cur.filter((k) => k !== i.key)))}
                              className="h-4 w-4 align-middle accent-spruce-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Գույնով նշված են փաթեթից տարբերվող տողերը։ Հաշվետվության էջն ինքը բացվում է փաթեթի «Ամսական հաշվետվություն» նշիչով։</p>
        </div>
      </Modal>
    </>
  );
}
