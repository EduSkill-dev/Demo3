"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REPORT_GROUPS, REPORT_ITEMS, REPORT_KEYS, type ReportGroup, type ReportItem } from "@/lib/report/items";
import Modal from "@/components/ui/Modal";
import { adminAction, adminButton, adminGhost } from "./adminApi";

// The "Հաշվետվություն" chip in a club's row: which lines of the monthly
// report this club sees. Without changes the club follows its plan's list;
// "reset" brings it back to that.
export default function ClubReportEditor({
  userId,
  label,
  planName,
  planItems,
  clubItems,
}: {
  userId: string;
  label: string;
  planName: string;
  planItems: ReportItem[]; // the plan's default list
  clubItems: ReportItem[] | null; // null = follows the plan
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReportItem[]>(clubItems ?? planItems);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const own = clubItems !== null;
  const same = (a: ReportItem[], b: ReportItem[]) => a.length === b.length && a.every((k) => b.includes(k));
  const asPlan = same(items, planItems);

  async function save(next: ReportItem[] | null) {
    setBusy(true);
    setError(null);
    const res = await adminAction({ action: "club.setReport", userId, items: next });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        title={own ? "Հաշվետվության տողերը փոխված են այս ակումբի համար" : `Հաշվետվությունը՝ ըստ ${planName} փաթեթի`}
        onClick={() => {
          setItems(clubItems ?? planItems);
          setError(null);
          setOpen(true);
        }}
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          own
            ? "border-apricot-500 bg-apricot-100 text-apricot-700"
            : "border-line bg-surface text-ink hover:border-spruce-500"
        }`}
      >
        Հաշվետվություն
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Հաշվետվություն՝ ${label}`}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 whitespace-normal text-left font-normal">
            <button type="button" disabled={busy || (!own && asPlan)} className={adminGhost} onClick={() => (own ? save(null) : setItems(planItems))}>
              Վերադարձնել փաթեթի լռելյայնը
            </button>
            <div className="flex gap-2">
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
        <div className="whitespace-normal text-left font-normal">
          <p className="text-sm text-muted">
            Նշված տողերն ակումբը տեսնում է իր ամսական հաշվետվության մեջ։ {planName ? `${planName} փաթեթի լռելյայն ցանկում` : "Լռելյայն ցանկում"} կա {planItems.length} տող
            {own ? "․ այս ակումբի համար ցանկը փոխված է։" : "․ ակումբը հետևում է փաթեթին։"}
          </p>
          {(Object.keys(REPORT_GROUPS) as ReportGroup[]).map((g) => (
            <section key={g} className="mt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{REPORT_GROUPS[g]}</h3>
              <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {REPORT_ITEMS.filter((i) => i.group === g).map((i) => {
                  const differs = planItems.includes(i.key) !== items.includes(i.key);
                  return (
                    <label key={i.key} className={`flex items-start gap-2.5 rounded-lg px-2 py-1 text-sm text-ink ${differs ? "bg-apricot-500/15" : ""}`}>
                      <input
                        type="checkbox"
                        checked={items.includes(i.key)}
                        onChange={(e) => setItems((cur) => (e.target.checked ? [...cur, i.key] : cur.filter((k) => k !== i.key)))}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-spruce-500"
                      />
                      {i.label}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
          <p className="mt-4 text-xs text-muted">Գույնով նշված են փաթեթի լռելյայնից տարբերվող տողերը։ Հաշվետվության էջն ինքը բացվում է փաթեթի «Ամսական հաշվետվություն» նշիչով։</p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
