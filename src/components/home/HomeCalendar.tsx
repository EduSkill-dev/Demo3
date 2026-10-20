"use client";

import { useState } from "react";
import MonthDays, { type MonthCell } from "@/components/calendar/MonthDays";

export type HomeMonth = { key: string; title: string; cells: MonthCell[] };

// The home page's month: the real hikes as dots, from this month to the last
// one with a hike. A day (or a stretch dragged over) opens the calendar with
// those days set as the filter. The months come ready from the server, so
// the arrows need no reload.
export default function HomeCalendar({
  months,
  today,
  weekdays,
  legend,
  prev,
  next,
}: {
  months: HomeMonth[];
  today: string;
  weekdays: string[];
  legend: { label: string; color: string }[];
  prev: string;
  next: string;
}) {
  const [i, setI] = useState(0);
  const m = months[i];
  const hrefFor = Object.fromEntries(m.cells.map((c) => [c.d, `/calendar?from=${c.d}&to=${c.d}`]));
  const arrow = "flex h-8 w-8 items-center justify-center rounded-full border-2 border-line text-lg leading-none text-ink transition hover:border-spruce-500 disabled:opacity-30 disabled:hover:border-line";
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setI((v) => v - 1)} disabled={i === 0} aria-label={prev} className={arrow}>‹</button>
        <p className="min-w-0 flex-1 truncate text-center text-[15px] font-bold text-heading">{m.title}</p>
        <button type="button" onClick={() => setI((v) => v + 1)} disabled={i === months.length - 1} aria-label={next} className={arrow}>›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted">
        {weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <MonthDays cells={m.cells} from="" to="" today={today} hrefFor={hrefFor} />
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full ring-1 ring-black/10 dark:ring-white/30" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
