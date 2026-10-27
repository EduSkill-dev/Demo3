"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminAction } from "./adminApi";
import { STATUS_LABELS, type AccountLimit, type AccountStatus } from "@/lib/adminLabels";
import AccountActions, { LimitSwitches } from "./AccountActions";
import SearchBox from "./SearchBox";
import ClubPlanEditor from "./ClubPlanEditor";
import ClubShareEditor from "./ClubShareEditor";
import CertificateReview, { type CertificateInfo } from "./CertificateReview";
import ClubReportEditor from "./ClubReportEditor";
import type { ReportItem } from "@/lib/report/items";
import type { ShareNetwork } from "@/lib/share";
import type { Plans, PlanOverrides } from "@/lib/plans/registry";
import { SortButton, sortRows, type SortState } from "./Sortable";

export type AccountRow = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: AccountStatus;
  joined: string; // already formatted
  joinedAt: string; // the same, as an ISO date (for sorting)
  extra?: [string, string?]; // e.g. the club's package and, under it, until when
  planId?: string | null; // the club's active plan, for the plan window
  overrides?: PlanOverrides; // what this club has apart from its plan
  shareBlocked?: ShareNetwork[]; // clubs: social networks closed for this club
  reportItems?: ReportItem[] | null; // clubs: the report lines set for this club (null = the plan's)
  limits: { key: AccountLimit; blocked: boolean }[]; // functions an admin can force off
  certificate?: CertificateInfo | null; // clubs: the uploaded certificate and its check
  hikes?: { past: number; upcoming: number }; // individuals: hikes taken part in, and booked to come
};

type HikeItem = { tourId: string; title: string; date: string; clubId: string | null; clubName: string | null };
type Which = "past" | "upcoming";
const dayText = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("hy-AM", { day: "numeric", month: "short", year: "numeric" });

const BADGE: Record<AccountStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  frozen: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

const th = "whitespace-nowrap px-2 py-2.5 font-semibold first:pl-3 last:pr-3";
const td = "whitespace-nowrap px-2 py-2 first:pl-3 last:pr-3";
// The plan, joined and status columns sit close to the name with some air
// between them; the functions column takes the spare width, its tags
// starting from the left on every line.
const mid = "px-4";

// The individuals list and the clubs list are the same table. Nothing wraps:
// the name sits over the contact details, everything else is one line, and a
// narrow screen scrolls the table sideways. Names A–Z at first; the name,
// plan and date headers sort (again = reversed).
export default function AccountsTable({
  title,
  nameHeader,
  extraHeader,
  plans,
  shareNetworks,
  planReports,
  rows,
}: {
  title: string;
  nameHeader: string;
  extraHeader?: string;
  plans?: Plans; // given = the plan can be changed here (super admin)
  shareNetworks?: ShareNetwork[]; // clubs list: what the platform has switched on
  planReports?: Record<string, { name: string; items: ReportItem[] }>; // clubs list: each plan's default report
  rows: AccountRow[];
}) {
  const [sort, setSort] = useState<SortState>({ col: "name", dir: "asc" });
  // Individuals: the hikes a person took part in (grey) and those booked to
  // come (green "+n"). A number opens its list under the row; a second click
  // or a click elsewhere closes it. Lists load when opened (logged).
  const showHikes = rows.some((r) => r.hikes);
  const [open, setOpen] = useState<{ userId: string; which: Which } | null>(null);
  const [lists, setLists] = useState<Record<string, HikeItem[] | { error: string }>>({});
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const zone = (e.target as HTMLElement).closest("[data-hikes-zone]");
      if (zone?.getAttribute("data-hikes-zone") !== open.userId) setOpen(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  async function showList(userId: string, which: Which) {
    if (open?.userId === userId && open.which === which) return setOpen(null);
    setOpen({ userId, which });
    const key = `${userId}:${which}`;
    if (lists[key] && !("error" in lists[key])) return;
    const res = await adminAction<{ items: HikeItem[] }>({ action: "individual.hikes", userId, which });
    setLists((l) => ({ ...l, [key]: res.error !== null ? { error: res.error } : res.data.items }));
  }
  const columns = 5 + (extraHeader ? 1 : 0) + (showHikes ? 1 : 0);
  const sorted = useMemo(
    () => sortRows(rows, { name: (r) => r.name || r.email, extra: (r) => r.extra?.[0] ?? null, joined: (r) => r.joinedAt }, sort),
    [rows, sort]
  );
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-heading">
          {title} ({rows.length})
        </h2>
        <SearchBox placeholder="Փնտրել ըստ անվան, էլ. հասցեի, հեռախոսի" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className={th}><SortButton label={nameHeader} col="name" sort={sort} onSort={setSort} /></th>
              {showHikes && <th className={`${th} ${mid} text-center`} title="Մասնակցած արշավներ · առաջիկա գրանցումներ">Արշավներ</th>}
              {extraHeader && <th className={`${th} ${mid} text-center`}><SortButton label={extraHeader} col="extra" sort={sort} onSort={setSort} /></th>}
              <th className={`${th} ${mid} text-center`}><SortButton label="Գրանցվել է" col="joined" sort={sort} onSort={setSort} /></th>
              <th className={`${th} ${mid} text-center`}>Կարգավիճակ</th>
              <th className={`${th} ${mid} w-full text-left`}>Ֆունկցիաներ</th>
              <th className={`${th} text-right`}>Գործողություններ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns} className="px-4 py-6 text-center text-muted">Հաշիվ չի գտնվել։</td>
              </tr>
            )}
            {sorted.map((r) => (
              <Fragment key={r.userId}>
              <tr className={`border-b border-line last:border-0 ${open?.userId === r.userId ? "bg-sand/40" : ""}`}>
                <td className={td}>
                  {/* A fixed width, so long names and addresses are cut with "…" (full text on hover). */}
                  <div className="w-[13rem] 2xl:w-[20rem]">
                    <span className="block truncate font-medium text-ink" title={r.name}>{r.name || "—"}</span>
                    {/* The phone under the address, so the row stays narrow. */}
                    <span className="block truncate text-xs text-muted" title={r.email}>{r.email}</span>
                    {r.phone && <span className="block truncate text-xs text-muted">{r.phone}</span>}
                  </div>
                </td>
                {showHikes && (
                  <td className={`${td} ${mid} text-center`} data-hikes-zone={r.userId}>
                    {r.hikes && (
                      <span className="inline-flex items-center gap-2 text-sm font-bold tabular-nums">
                        <button
                          type="button"
                          title="Մասնակցած արշավներ"
                          aria-expanded={open?.userId === r.userId && open.which === "past"}
                          onClick={() => showList(r.userId, "past")}
                          className={`rounded-full px-2 py-0.5 transition ${open?.userId === r.userId && open.which === "past" ? "bg-sand text-ink" : "text-muted hover:bg-sand hover:text-ink"}`}
                        >
                          {r.hikes.past}
                        </button>
                        <button
                          type="button"
                          title="Առաջիկա գրանցումներ"
                          aria-expanded={open?.userId === r.userId && open.which === "upcoming"}
                          onClick={() => showList(r.userId, "upcoming")}
                          className={`rounded-full px-2 py-0.5 transition ${r.hikes.upcoming ? "text-green-700 dark:text-green-400" : "text-muted"} ${open?.userId === r.userId && open.which === "upcoming" ? "bg-sand" : "hover:bg-sand"}`}
                        >
                          {r.hikes.upcoming ? `+${r.hikes.upcoming}` : 0}
                        </button>
                      </span>
                    )}
                  </td>
                )}
                {extraHeader && (
                  <td className={`${td} ${mid} text-center`}>
                    <span className="flex items-center justify-center gap-1.5 font-medium text-ink">
                      {r.extra?.[0] ?? "—"}
                      {plans && (
                        <ClubPlanEditor userId={r.userId} label={r.name || r.email} current={r.planId ?? null} until={r.extra?.[1]} overrides={r.overrides ?? {}} plans={plans} />
                      )}
                    </span>
                    {r.extra?.[1] && <span className="block text-xs text-muted">{r.extra[1]}</span>}
                  </td>
                )}
                <td className={`${td} ${mid} text-center text-muted`}>{r.joined}</td>
                <td className={`${td} ${mid} text-center`}>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                </td>
                <td className={`${td} ${mid}`}>
                  <div className="flex max-w-[17rem] flex-wrap items-start justify-start gap-1.5">
                    <LimitSwitches userId={r.userId} label={r.name || r.email} limits={r.limits} />
                    {r.certificate && <CertificateReview userId={r.userId} label={r.name || r.email} cert={r.certificate} />}
                    {shareNetworks && r.shareBlocked && (
                      <ClubShareEditor userId={r.userId} label={r.name || r.email} blocked={r.shareBlocked} platform={shareNetworks} />
                    )}
                    {planReports && r.planId && planReports[r.planId] && (
                      <ClubReportEditor
                        userId={r.userId}
                        label={r.name || r.email}
                        planId={r.planId}
                        planReports={planReports}
                        clubItems={r.reportItems ?? null}
                      />
                    )}
                  </div>
                </td>
                <td className={td}>
                  <AccountActions userId={r.userId} status={r.status} label={r.name || r.email} />
                </td>
              </tr>
              {open?.userId === r.userId && (
                <tr className="border-b border-line bg-sand/25" data-hikes-zone={r.userId}>
                  <td colSpan={columns} className="px-4 py-3">
                    <HikeList which={open.which} list={lists[`${r.userId}:${open.which}`]} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Ֆունկցիաներ՝ կանաչը միացված է, կարմիրը՝ անջատված։ Սեղմեք՝ փոխելու համար։
      </p>
    </div>
  );
}

// One person's hikes under their row: the hike (its page), the date, the club
// (its page, with a way back here).
function HikeList({ which, list }: { which: Which; list: HikeItem[] | { error: string } | undefined }) {
  if (!list) return <p className="text-sm text-muted">Բեռնվում է…</p>;
  if ("error" in list) return <p className="text-sm text-red-600">{list.error}</p>;
  if (list.length === 0) return <p className="text-sm text-muted">{which === "past" ? "Դեռ չի մասնակցել որևէ արշավի։" : "Առաջիկա գրանցում չունի։"}</p>;
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{which === "past" ? "Մասնակցած արշավներ" : "Առաջիկա գրանցումներ"}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {list.map((h) => (
          <li key={h.tourId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2 text-[13px]">
            <Link href={`/tours/${h.tourId}`} className="font-semibold text-ink hover:text-terracotta-700 hover:underline">{h.title}</Link>
            <span className="flex items-baseline gap-4 text-muted">
              <span className="whitespace-nowrap">{dayText(h.date)}</span>
              {h.clubId ? (
                <Link href={`/clubs/${h.clubId}?back=${encodeURIComponent("/admin/individuals")}`} className="whitespace-nowrap hover:text-terracotta-700 hover:underline">{h.clubName}</Link>
              ) : (
                <span>—</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
