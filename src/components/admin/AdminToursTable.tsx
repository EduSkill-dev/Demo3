"use client";

import { Fragment, useEffect, useState } from "react";
import { adminAction } from "./adminApi";

export type AdminTourRow = {
  id: string;
  title: React.ReactNode;
  club: string;
  date: string; // already formatted
  status: React.ReactNode;
  action: React.ReactNode;
  seats: { free: number; cap: number };
};

type Person = {
  id: string;
  userId: string | null;
  guest: boolean;
  name: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  status: string;
  bookedAt: string;
  cancelledAt: string | null;
  attended: boolean | null;
  emergency: string | null;
  paid: number | null;
};

const when = (iso: string) => new Date(iso).toLocaleString("hy-AM", { timeZone: "Asia/Yerevan", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const age = (birth: string | null) => {
  if (!birth) return null;
  const b = new Date(birth);
  const n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
};

// The listings with their seats as "free/all" (as the cards count them). A
// click on the seats opens the people booked on that hike right under its
// row; a second click, or a click anywhere else, closes it. The list is
// fetched when opened (each opening is logged on the server).
export default function AdminToursTable({ head, rows, empty }: { head: React.ReactNode; rows: AdminTourRow[]; empty: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [lists, setLists] = useState<Record<string, Person[] | { error: string }>>({});

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const zone = (e.target as HTMLElement).closest("[data-seats-zone]");
      if (zone?.getAttribute("data-seats-zone") !== open) setOpen(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  async function toggle(id: string) {
    if (open === id) return setOpen(null);
    setOpen(id);
    if (lists[id] && !("error" in lists[id])) return;
    const res = await adminAction<{ people: Person[] }>({ action: "tour.participants", tourId: id });
    setLists((l) => ({ ...l, [id]: res.error !== null ? { error: res.error } : res.data.people }));
  }

  return (
    <table className="w-full text-left text-[13px]">
      {head}
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-center text-muted">{empty}</td>
          </tr>
        )}
        {rows.map((r) => {
          const isOpen = open === r.id;
          const list = lists[r.id];
          const full = r.seats.cap > 0 && r.seats.free === 0;
          return (
            <Fragment key={r.id}>
              <tr className={`border-b border-line last:border-0 ${isOpen ? "bg-sand/40" : ""}`}>
                <td className="px-4 py-3">{r.title}</td>
                <td className="whitespace-nowrap px-4 py-3" data-seats-zone={r.id}>
                  <button
                    type="button"
                    onClick={() => toggle(r.id)}
                    aria-expanded={isOpen}
                    title="Ազատ տեղեր / ընդհանուր․ սեղմեք՝ մասնակիցներին տեսնելու համար"
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-bold tabular-nums transition ${
                      isOpen
                        ? "border-terracotta-500 bg-terracotta-500 text-white"
                        : full
                          ? "border-terracotta-500/50 text-terracotta-700 hover:border-terracotta-500 dark:text-terracotta-300"
                          : "border-line text-ink hover:border-spruce-500"
                    }`}
                  >
                    {r.seats.free}/{r.seats.cap}
                    <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 8l5 5 5-5" /></svg>
                  </button>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{r.club}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{r.date}</td>
                <td className="whitespace-nowrap px-4 py-3">{r.status}</td>
                <td className="px-4 py-3">{r.action}</td>
              </tr>
              {isOpen && (
                <tr className="border-b border-line bg-sand/25" data-seats-zone={r.id}>
                  <td colSpan={6} className="px-4 py-3">
                    {!list ? (
                      <p className="text-sm text-muted">Բեռնվում է…</p>
                    ) : "error" in list ? (
                      <p className="text-sm text-red-600">{list.error}</p>
                    ) : list.length === 0 ? (
                      <p className="text-sm text-muted">Այս արշավին դեռ ոչ ոք չի գրանցվել։</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                        <table className="w-full text-left text-[12.5px]">
                          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                            <tr>
                              <th className="px-3 py-2">#</th>
                              <th className="px-3 py-2">Մասնակից</th>
                              <th className="px-3 py-2">Կապ</th>
                              <th className="px-3 py-2">Անհետաձգելի կապ</th>
                              <th className="px-3 py-2">Գրանցվել է</th>
                              <th className="px-3 py-2">Վճար</th>
                              <th className="px-3 py-2">Ներկա</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((p, i) => {
                              const off = p.status !== "confirmed";
                              const years = age(p.birthDate);
                              return (
                                <tr key={p.id} className={`border-b border-line last:border-0 ${off ? "text-muted line-through decoration-muted/50" : ""}`}>
                                  <td className="px-3 py-2 tabular-nums text-muted">{i + 1}</td>
                                  <td className="px-3 py-2">
                                    <span className="font-semibold text-ink">{p.name}</span>
                                    {p.guest && <span className="ml-1.5 rounded-full bg-sand px-1.5 py-0.5 text-[10px] font-semibold text-muted no-underline">հյուր</span>}
                                    {(years !== null || p.gender) && (
                                      <span className="block text-[11px] text-muted">
                                        {[years !== null ? `${years} տ.` : null, p.gender === "male" ? "արական" : p.gender === "female" ? "իգական" : null].filter(Boolean).join(" · ")}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    {p.email && <a href={`mailto:${p.email}`} className="block hover:text-terracotta-700">{p.email}</a>}
                                    {p.phone && <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="block text-muted hover:text-terracotta-700">{p.phone}</a>}
                                  </td>
                                  <td className="px-3 py-2 text-muted">{p.emergency ?? "—"}</td>
                                  <td className="whitespace-nowrap px-3 py-2 text-muted">
                                    {when(p.bookedAt)}
                                    {off && <span className="block text-[11px] no-underline">չեղարկել է{p.cancelledAt ? ` ${when(p.cancelledAt)}` : ""}</span>}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">{p.paid !== null ? `${p.paid.toLocaleString("en-US").replace(/,/g, " ")} ֏` : <span className="text-muted">—</span>}</td>
                                  <td className="px-3 py-2">{p.attended === true ? "✓" : p.attended === false ? "✕" : <span className="text-muted">—</span>}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
