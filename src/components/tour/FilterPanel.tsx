"use client";

import { useState } from "react";

// On phones the filter box folds into one row — "Filters (n)" and how many
// were found — so the hikes start on the first screen. Wider screens always
// show the filters.
export default function FilterPanel({ active, found, show, hide, children }: { active: number; found: string; show: string; hide: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex h-10 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition ${
            active ? "border-terracotta-500 bg-terracotta-500/10 text-ink" : "border-line bg-surface text-ink"
          }`}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M3 5h14M6 10h8M8.5 15h3" />
          </svg>
          {open ? hide : show}
          {active > 0 && <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-terracotta-500 px-1.5 text-xs font-bold text-white">{active}</span>}
        </button>
        <span className="rounded-full bg-apricot-100 px-3 py-1 text-sm font-bold text-apricot-700 dark:bg-apricot-500/20 dark:text-apricot-300">{found}</span>
      </div>
      <div className={open ? "max-md:mt-3" : "max-md:hidden"}>{children}</div>
    </>
  );
}
