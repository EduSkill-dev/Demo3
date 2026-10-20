"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type MonthCell = {
  d: string; // YYYY-MM-DD
  inMonth: boolean;
  count: number;
  dots: string[]; // difficulty colours of the day's first hikes
  title?: string;
  label: string;
};

// The calendar's month. A click chooses a day (from = to = that day); press
// and slide over the days to choose a stretch of them. The slide stays in
// this month: the neighbouring months' days only open themselves.
export default function MonthDays({
  cells,
  from,
  to,
  today,
  hrefFor,
}: {
  cells: MonthCell[];
  from: string; // the chosen stretch ("" when none)
  to: string;
  today: string;
  hrefFor: Record<string, string>; // day → its link (from = to = day)
}) {
  const router = useRouter();
  const [drag, setDrag] = useState<{ start: string; cur: string } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const swallowClick = useRef(false);
  const inMonth = new Set(cells.filter((c) => c.inMonth).map((c) => c.d));

  // Let go anywhere: a stretch of two days or more opens; one day is the
  // link's own click.
  useEffect(() => {
    const up = () => {
      const g = dragRef.current;
      if (!g) return;
      setDrag(null);
      if (g.start === g.cur) return;
      swallowClick.current = true;
      setTimeout(() => (swallowClick.current = false), 0);
      const [lo, hi] = g.start < g.cur ? [g.start, g.cur] : [g.cur, g.start];
      const url = new URL(hrefFor[lo], window.location.origin);
      url.searchParams.set("from", lo);
      url.searchParams.set("to", hi);
      router.push(`${url.pathname}?${url.searchParams}`, { scroll: false });
    };
    const cancel = () => setDrag(null);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [hrefFor, router]);

  // The day under the pointer (touch keeps the events on the first cell).
  const over = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-day]");
    const d = el?.dataset.day;
    if (d && inMonth.has(d)) setDrag((g) => (g && g.cur !== d ? { ...g, cur: d } : g));
  };

  const [lo, hi] = drag ? (drag.start < drag.cur ? [drag.start, drag.cur] : [drag.cur, drag.start]) : [from, to || from];

  return (
    <div className="mt-1 grid touch-none select-none grid-cols-7 gap-1" onPointerMove={(e) => drag && over(e.clientX, e.clientY)}>
      {cells.map((c) => {
        const end = !!lo && (c.d === lo || c.d === hi);
        const between = !!lo && c.d > lo && c.d < hi;
        return (
          <Link
            key={c.d}
            href={hrefFor[c.d]}
            data-day={c.d}
            scroll={false}
            rel="nofollow"
            draggable={false}
            prefetch={false} // a month of day links must not mean a month of requests
            title={c.title}
            aria-label={c.label}
            aria-current={end ? "date" : undefined}
            onPointerDown={(e) => {
              if (!c.inMonth || e.button !== 0) return;
              e.preventDefault();
              setDrag({ start: c.d, cur: c.d });
            }}
            onClick={(e) => {
              if (swallowClick.current) e.preventDefault();
            }}
            className={`flex h-11 flex-col items-center justify-center gap-1 rounded-lg border-2 transition ${
              end
                ? "border-terracotta-500 bg-terracotta-500/15"
                : between
                  ? "border-transparent bg-terracotta-500/10"
                  : c.d === today
                    ? "border-spruce-500"
                    : c.count
                      ? "border-transparent bg-sand hover:border-spruce-500"
                      : "border-transparent hover:border-line"
            } ${c.inMonth ? "" : "opacity-40"}`}
          >
            <span className={`text-[13px] leading-none ${c.count ? "font-bold text-ink" : "text-muted"}`}>{+c.d.slice(8, 10)}</span>
            <span className="flex h-1.5 gap-0.5">
              {c.dots.map((color, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full ring-1 ring-black/10 dark:ring-white/30" style={{ background: color }} />
              ))}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
