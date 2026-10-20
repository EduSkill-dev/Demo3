"use client";

import { useState } from "react";

// Below the widest screens the view switch and the count sit in one row on
// top of the filters; on phones the filters fold behind "Filters (n)" so the
// hikes start on the first screen. Wide screens show it all inside the grid.
export default function FilterPanel({
  active,
  found,
  switcher,
  show,
  hide,
  children,
}: {
  active: number;
  found: React.ReactNode;
  switcher: React.ReactNode;
  show: string;
  hide: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex h-9 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition md:hidden ${
            active ? "border-terracotta-500 bg-terracotta-500/10 text-ink" : "border-line bg-surface text-ink dark:border-spruce-300/70"
          }`}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M3 5h14M6 10h8M8.5 15h3" />
          </svg>
          {open ? hide : show}
          {active > 0 && <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-terracotta-500 px-1.5 text-xs font-bold text-white">{active}</span>}
        </button>
        {switcher}
        <div className="max-md:basis-full md:order-first">{found}</div>
      </div>
      <div className={`max-lg:mt-3 ${open ? "" : "max-md:hidden"}`}>{children}</div>
    </>
  );
}
