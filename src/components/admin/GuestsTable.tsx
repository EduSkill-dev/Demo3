"use client";

import { Fragment, useState } from "react";
import Link from "next/link";

export type GuestRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  birth: string;
  gender: string;
  lastBooked: string;
  paid: number;
  hikes: {
    id: string;
    tourId: string | null;
    title: string;
    date: string;
    clubId: string | null;
    clubName: string | null;
    cancelled: boolean;
    paid: number;
  }[];
};

const money = (n: number) => `${n.toLocaleString("en-US").replace(/,/g, " ")} ֏`;
const th = "whitespace-nowrap px-3 py-2.5 font-semibold";
const td = "whitespace-nowrap px-3 py-2";

// One line per guest; the count of hikes opens the list of them under the line.
export default function GuestsTable({ rows }: { rows: GuestRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div id="guests" className="mt-4 scroll-mt-24 overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className={th}>Անուն</th>
            <th className={th}>Հեռախոս</th>
            <th className={th}>Ծննդյան օր</th>
            <th className={th}>Սեռ</th>
            <th className={th}>Արշավներ</th>
            <th className={th}>Վճարված</th>
            <th className={th}>Վերջին ամրագրումը</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted">Հյուրեր չկան։</td>
            </tr>
          )}
          {rows.map((g) => (
            <Fragment key={g.id}>
              <tr className="border-b border-line align-top last:border-0">
                <td className={td}>
                  <span className="block font-medium text-ink">{g.name}</span>
                  <a href={`mailto:${g.email}`} className="text-xs text-muted hover:text-terracotta-700 hover:underline">{g.email}</a>
                </td>
                <td className={td}><a href={`tel:${g.phone.replace(/[^+0-9]/g, "")}`} className="text-ink hover:text-terracotta-700 hover:underline">{g.phone}</a></td>
                <td className={`${td} text-muted`}>{g.birth}</td>
                <td className={`${td} text-muted`}>{g.gender === "female" ? "Իգական" : "Արական"}</td>
                <td className={td}>
                  <button type="button" aria-expanded={open === g.id} onClick={() => setOpen(open === g.id ? null : g.id)} className="font-semibold text-terracotta-700 hover:underline">
                    {g.hikes.length} {open === g.id ? "▴" : "▾"}
                  </button>
                </td>
                <td className={`${td} tabular-nums text-ink`}>{g.paid > 0 ? money(g.paid) : <span className="text-muted">—</span>}</td>
                <td className={`${td} text-muted`}>{g.lastBooked}</td>
              </tr>
              {open === g.id && (
                <tr className="border-b border-line bg-sand/40 last:border-0">
                  <td colSpan={7} className="px-3 py-2">
                    <ul className="space-y-1.5">
                      {g.hikes.map((h) => (
                        <li key={h.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="whitespace-nowrap text-muted">{h.date}</span>
                          {h.tourId ? (
                            <Link href={`/tours/${h.tourId}?back=${encodeURIComponent("/admin/guests")}`} className="font-medium text-ink hover:text-terracotta-700 hover:underline">{h.title}</Link>
                          ) : (
                            <span className="font-medium text-ink">{h.title}</span>
                          )}
                          {h.clubId && (
                            <Link href={`/clubs/${h.clubId}?back=${encodeURIComponent("/admin/guests")}`} className="text-muted hover:text-terracotta-700 hover:underline">{h.clubName}</Link>
                          )}
                          {h.paid > 0 && <span className="tabular-nums text-ink">{money(h.paid)}</span>}
                          {h.cancelled && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">Չեղարկված</span>}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
