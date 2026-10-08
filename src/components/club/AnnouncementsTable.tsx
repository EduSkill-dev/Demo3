"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useFormatDate, useT } from "@/i18n/client";
import CountBadge from "@/components/ui/CountBadge";
import type { TourStatus } from "@/types/database";

export type ListingRow = {
  id: string;
  title: string;
  date: string;
  regions: string[];
  status: TourStatus;
  adminHidden: boolean;
  taken: number; // confirmed applications (A)
  cap: number; // seats the package allows for this tour (B)
  unread: number; // applications or cancellations the club has not opened
  past: boolean;
};

// The club's listings: Place · Applications A/B (+ unread badge) · Date ·
// Region · Edit / Hide / Delete. A tour with participants is cancelled
// rather than deleted, so they hear about it.
export default function AnnouncementsTable({ rows }: { rows: ListingRow[] }) {
  const t = useT();
  const fmt = useFormatDate();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upcoming = rows.filter((r) => !r.past);
  const past = rows.filter((r) => r.past).reverse();

  async function run(id: string, action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(id);
    setError(null);
    const { error: err } = await action();
    setBusy(null);
    if (err) return setError(serverErrorMessage(t, err.message));
    router.refresh();
  }

  const supabase = () => createClient();
  const setStatus = (r: ListingRow, status: TourStatus) =>
    run(r.id, () => supabase().from("tours").update({ status }).eq("id", r.id));
  function remove(r: ListingRow) {
    if (r.taken > 0) {
      if (confirm(t("announcements.confirmCancel", { title: r.title, count: r.taken }))) setStatus(r, "cancelled");
    } else if (confirm(t("announcements.confirmDelete", { title: r.title }))) {
      run(r.id, () => supabase().from("tours").delete().eq("id", r.id));
    }
  }

  const day = (d: string) => fmt(d, "short");

  const table = (list: ListingRow[], withActions: boolean) => (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">{t("announcements.colPlace")}</th>
            <th className="px-4 py-3">{t("announcements.colApplications")}</th>
            <th className="px-4 py-3">{t("announcements.colDate")}</th>
            <th className="px-4 py-3">{t("announcements.colRegion")}</th>
            {withActions && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted">{t("announcements.empty")}</td>
            </tr>
          )}
          {list.map((r) => (
            <tr key={r.id} className={`border-b border-line last:border-0 ${r.status === "cancelled" ? "opacity-60" : ""}`}>
              <td className="px-4 py-3">
                <span className="font-medium text-ink">{r.title}</span>
                {r.status !== "active" && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    r.status === "hidden" ? "bg-sand text-muted" : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  }`}>
                    {r.status === "hidden" ? t("announcements.hidden") : t("announcements.cancelled")}
                  </span>
                )}
                {r.adminHidden && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                    {t("announcements.adminHidden")}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <Link href="/dashboard/applications" className="relative inline-flex items-start pr-3 font-semibold text-ink hover:text-terracotta-700">
                  <span className={r.taken >= r.cap && r.cap > 0 ? "text-red-600" : ""}>
                    {r.taken}/{r.cap}
                  </span>
                  {r.unread > 0 && (
                    <CountBadge
                      count={r.unread}
                      label={t("announcements.unread", { count: r.unread })}
                      className="absolute -right-2 -top-2.5 scale-90"
                    />
                  )}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-ink">{day(r.date)}</td>
              <td className="px-4 py-3 text-muted">{r.regions.map((x) => t(`region.${x}`)).join(", ")}</td>
              {withActions && (
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {r.status !== "cancelled" && (
                    <div className="flex justify-end gap-3 font-semibold">
                      <Link href={`/dashboard/listings/${r.id}/edit`} className="text-terracotta-500 hover:text-terracotta-700">
                        {t("common.edit")}
                      </Link>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => setStatus(r, r.status === "hidden" ? "active" : "hidden")}
                        className="text-muted hover:text-ink disabled:opacity-50"
                      >
                        {r.status === "hidden" ? t("announcements.show") : t("announcements.hide")}
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => remove(r)}
                        className="text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {r.taken > 0 ? t("announcements.cancelTour") : t("common.delete")}
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {table(upcoming, true)}
      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none text-sm font-semibold text-muted hover:text-ink">
            {t("announcements.past", { count: past.length })}
          </summary>
          <div className="mt-3">{table(past, false)}</div>
        </details>
      )}
    </div>
  );
}
