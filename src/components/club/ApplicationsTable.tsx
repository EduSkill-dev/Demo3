"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFormatDate, useT } from "@/i18n/client";
import Modal from "@/components/ui/Modal";

export type ApplicationRow = {
  id: string;
  seq: number; // k in k/B
  status: "confirmed" | "cancelled";
  createdAt: string;
  cancelledAt: string | null;
  unread: boolean;
  tourTitle: string;
  tourDate: string;
  cap: number; // B in k/B
  person: {
    first_name: string | null;
    last_name: string | null;
    birth_date: string | null;
    age: number | null;
    gender: string | null;
    email: string;
    phone: string | null;
  } | null;
};

function ageFrom(birth: string | null, legacyAge: number | null): number | null {
  if (!birth) return legacyAge;
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
}

// Newest first; unread rows in bold. Opening one marks it read.
export default function ApplicationsTable({ rows }: { rows: ApplicationRow[] }) {
  const t = useT();
  const fmtDate = useFormatDate();
  const router = useRouter();
  const [open, setOpen] = useState<ApplicationRow | null>(null);
  const [read, setRead] = useState<Set<string>>(new Set());

  const fmt = (iso: string, withTime = false) => fmtDate(iso, withTime ? "dateTime" : "short");

  async function view(row: ApplicationRow) {
    setOpen(row);
    if (row.unread && !read.has(row.id)) {
      setRead((s) => new Set(s).add(row.id));
      await createClient().rpc("mark_booking_read", { p_booking: row.id });
      router.refresh(); // badges elsewhere (listings) update too
    }
  }

  const name = (r: ApplicationRow) =>
    r.person
      ? [r.person.first_name, r.person.last_name].filter(Boolean).join(" ") || r.person.email
      : t("account.deletedUser");

  if (rows.length === 0) {
    return <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("applications.empty")}</p>;
  }

  const p = open?.person;
  const age = open ? ageFrom(p?.birth_date ?? null, p?.age ?? null) : null;
  const details: [string, React.ReactNode][] = open
    ? [
        [t("applications.name"), name(open)],
        ...(age != null ? ([[t("applications.age"), t("applications.years", { count: age })]] as [string, React.ReactNode][]) : []),
        ...(p?.gender ? ([[t("applications.gender"), p.gender === "female" ? t("auth.female") : t("auth.male")]] as [string, React.ReactNode][]) : []),
        [t("auth.email"), p?.email ? <a href={`mailto:${p.email}`} className="text-apricot hover:underline">{p.email}</a> : "—"],
        [t("auth.phone"), p?.phone ? <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="text-apricot hover:underline">{p.phone}</a> : "—"],
        [t("applications.tour"), open.tourTitle],
        [t("applications.tourDate"), fmt(open.tourDate)],
        [t("applications.applied"), fmt(open.createdAt, true)],
        [
          t("applications.status"),
          open.status === "confirmed"
            ? t("applications.confirmed")
            : t("applications.cancelledAt", { date: open.cancelledAt ? fmt(open.cancelledAt, true) : "—" }),
        ],
      ]
    : [];

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">{t("applications.colTour")}</th>
              <th className="px-4 py-3">{t("applications.colApplication")}</th>
              <th className="px-4 py-3">{t("applications.colDate")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const unread = r.unread && !read.has(r.id);
              return (
                <tr key={r.id} className={`border-b border-line last:border-0 ${unread ? "font-bold text-ink" : "text-ink"}`}>
                  <td className="px-4 py-3">
                    {unread && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-600 align-middle" aria-hidden />}
                    {r.tourTitle}
                    {r.status === "cancelled" && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                        {t("applications.cancelled")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{r.seq}/{r.cap}</td>
                  <td className="whitespace-nowrap px-4 py-3">{fmt(r.createdAt, true)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => view(r)} className="font-semibold text-apricot hover:text-apricot-dark">
                      {t("common.view")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? t("applications.modalTitle", { seq: open.seq, tour: open.tourTitle }) : ""}
      >
        {open && (
          <div className="space-y-4 text-sm">
            {open.status === "cancelled" && (
              <p className="rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {t("applications.refundNote")}
              </p>
            )}
            <dl className="divide-y divide-line rounded-xl border border-line">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Modal>
    </>
  );
}
