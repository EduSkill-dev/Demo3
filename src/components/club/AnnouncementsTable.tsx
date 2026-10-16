"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useFormatDate, useT } from "@/i18n/client";
import CountBadge from "@/components/ui/CountBadge";
import type { Difficulty, TourStatus } from "@/types/database";
import SharePanel from "./SharePanel";
import type { ShareNetwork } from "@/lib/share";
import { SortButton, sortRows, type SortState } from "@/components/admin/Sortable";

export type ListingRow = {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  difficulty: Difficulty;
  overnight: boolean;
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
export default function AnnouncementsTable({
  rows,
  canRepublish,
  clubName,
  shareNetworks,
  shareBlocked,
}: {
  rows: ListingRow[];
  canRepublish: boolean;
  clubName: string;
  shareNetworks: ShareNetwork[]; // switched on by the admins, and only with the plan's share_buttons
  shareBlocked: string[]; // of those, the ones an admin closed for this club
}) {
  const t = useT();
  const fmt = useFormatDate();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<ListingRow | null>(null);
  // The nearest hike first; past ones the latest first. Place, date and region sort.
  const [sortUp, setSortUp] = useState<SortState>({ col: "date", dir: "asc" });
  const [sortPast, setSortPast] = useState<SortState>({ col: "date", dir: "desc" });
  const getters = {
    title: (r: ListingRow) => r.title,
    date: (r: ListingRow) => r.date,
    region: (r: ListingRow) => r.regions.map((x) => t(`region.${x}`)).join(", ") || null,
  };

  const upcoming = rows.filter((r) => !r.past);
  const past = rows.filter((r) => r.past);

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

  // The parts of a row, shared by the table (wider screens) and the cards (phones).
  const titleOf = (r: ListingRow) => (
    <>
      <span className="font-medium text-ink">{r.title}</span>
      {r.status !== "active" && (
        <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          r.status === "hidden" ? "bg-sand text-muted" : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
        }`}>
          {r.status === "hidden" ? t("announcements.hidden") : t("announcements.cancelled")}
        </span>
      )}
      {r.adminHidden && (
        <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {t("announcements.adminHidden")}
        </span>
      )}
    </>
  );
  const appsOf = (r: ListingRow) => (
    <Link href={`/dashboard/applications?tour=${r.id}`} className="relative inline-flex items-start pr-3 font-semibold text-ink hover:text-terracotta-700">
      <span className={r.taken >= r.cap && r.cap > 0 ? "text-red-600" : ""}>
        {r.taken}/{r.cap}
      </span>
      {r.unread > 0 && (
        <CountBadge count={r.unread} label={t("announcements.unread", { count: r.unread })} className="absolute -right-2 -top-2.5 scale-90" />
      )}
    </Link>
  );
  const actionsOf = (r: ListingRow, kind: "upcoming" | "past", align: "end" | "start") =>
    kind === "upcoming" ? (
      r.status !== "cancelled" && (
        <div className={`flex flex-wrap gap-x-4 gap-y-2 font-semibold ${align === "end" ? "justify-end" : ""}`}>
          {/* Only a listing that visitors can see is worth sharing. */}
          {r.status === "active" && !r.adminHidden && (
            <button data-view type="button" onClick={() => setSharing(r)} className="text-spruce-500 hover:text-spruce-900 dark:text-spruce-300">
              {t("share.button")}
            </button>
          )}
          <Link href={`/dashboard/listings/${r.id}/edit`} className="text-terracotta-500 hover:text-terracotta-700">
            {t("common.edit")}
          </Link>
          <button type="button" disabled={busy === r.id} onClick={() => setStatus(r, r.status === "hidden" ? "active" : "hidden")} className="text-muted hover:text-ink disabled:opacity-50">
            {r.status === "hidden" ? t("announcements.show") : t("announcements.hide")}
          </button>
          <button type="button" disabled={busy === r.id} onClick={() => remove(r)} className="text-red-600 hover:text-red-700 disabled:opacity-50">
            {r.taken > 0 ? t("announcements.cancelTour") : t("common.delete")}
          </button>
        </div>
      )
    ) : canRepublish ? (
      // A new listing that starts as a copy of this one.
      <Link href={`/dashboard/listings/new?from=${r.id}`} className="font-semibold text-terracotta-500 hover:text-terracotta-700">
        {t("announcements.republish")}
      </Link>
    ) : (
      <span className="cursor-not-allowed font-semibold text-muted" title={t("announcements.republishBlocked")}>
        {t("announcements.republish")}
      </span>
    );

  const table = (all: ListingRow[], kind: "upcoming" | "past") => {
    const sort = kind === "upcoming" ? sortUp : sortPast;
    const onSort = kind === "upcoming" ? setSortUp : setSortPast;
    const list = sortRows(all, getters, sort);
    return (
      <>
        {/* Phones: one card per listing, the actions under it. */}
        <ul className="space-y-3 md:hidden">
          {list.length === 0 && <li className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">{t("announcements.empty")}</li>}
          {list.map((r) => (
            <li key={r.id} className={`rounded-xl border border-line bg-surface p-4 text-sm ${r.status === "cancelled" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0">{titleOf(r)}</p>
                <span className="shrink-0 pt-0.5">{appsOf(r)}</span>
              </div>
              <p className="mt-1 text-muted">
                {day(r.date)}
                {r.regions.length > 0 && <> · {r.regions.map((x) => t(`region.${x}`)).join(", ")}</>}
              </p>
              <div className="mt-3 border-t border-line pt-3">{actionsOf(r, kind, "start")}</div>
            </li>
          ))}
        </ul>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface max-md:hidden">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3"><SortButton label={t("announcements.colPlace")} col="title" sort={sort} onSort={onSort} /></th>
                <th className="px-4 py-3">{t("announcements.colApplications")}</th>
                <th className="px-4 py-3"><SortButton label={t("announcements.colDate")} col="date" sort={sort} onSort={onSort} /></th>
                <th className="px-4 py-3"><SortButton label={t("announcements.colRegion")} col="region" sort={sort} onSort={onSort} /></th>
                <th className="px-4 py-3" />
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
                  <td className="px-4 py-3">{titleOf(r)}</td>
                  <td className="px-4 py-3">{appsOf(r)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink">{day(r.date)}</td>
                  <td className="px-4 py-3 text-muted">{r.regions.map((x) => t(`region.${x}`)).join(", ")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{actionsOf(r, kind, "end")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {table(upcoming, "upcoming")}
      {sharing && (
        <SharePanel
          tour={{ id: sharing.id, title: sharing.title, date: sharing.date, endDate: sharing.endDate, regions: sharing.regions, difficulty: sharing.difficulty, overnight: sharing.overnight, left: Math.max(0, sharing.cap - sharing.taken) }}
          clubName={clubName}
          networks={shareNetworks}
          blocked={shareBlocked}
          onClose={() => setSharing(null)}
        />
      )}
      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none text-sm font-semibold text-muted hover:text-ink">
            {t("announcements.past", { count: past.length })}
          </summary>
          <div className="mt-3">{table(past, "past")}</div>
        </details>
      )}
    </div>
  );
}
