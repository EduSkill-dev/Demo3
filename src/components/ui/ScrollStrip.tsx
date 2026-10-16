"use client";

import { useEffect, useRef, useState } from "react";

// A row that scrolls sideways. When it does not fit, arrows at its ends move
// it by about a screenful; at an end that arrow fades out.
export default function ScrollStrip({ children, prevLabel, nextLabel }: { children: React.ReactNode; prevLabel: string; nextLabel: string }) {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () => setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
    measure();
    // Keep the chosen day in view on first paint.
    el.querySelector<HTMLElement>("[aria-current]")?.scrollIntoView({ block: "nearest", inline: "center" });
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [children]);

  const move = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * Math.max(120, row.current.clientWidth * 0.8), behavior: "smooth" });
  const fits = edges.start && edges.end;
  const arrow = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-lg leading-none text-ink transition hover:border-spruce-500 disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="flex min-w-[15rem] flex-1 items-center gap-2">
      {!fits && (
        <button type="button" onClick={() => move(-1)} disabled={edges.start} aria-label={prevLabel} className={arrow}>‹</button>
      )}
      <div ref={row} className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5">
        {children}
      </div>
      {!fits && (
        <button type="button" onClick={() => move(1)} disabled={edges.end} aria-label={nextLabel} className={arrow}>›</button>
      )}
    </div>
  );
}
