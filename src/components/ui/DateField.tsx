"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { addMonths, dateWords, monthGrid, monthOf, todayInYerevan } from "@/lib/calendar";

// A date field in the site's look: the browser's own picker cannot be
// styled, so this one opens a small month of our own. The value travels in a
// hidden input; choosing a day sends the surrounding (auto-submitting) form.
export default function DateField({
  name,
  value,
  min,
  label,
  className = "",
}: {
  name: string;
  value: string; // YYYY-MM-DD or ""
  min?: string;
  label: string;
  className?: string; // the filter box's field look (outlined when set)
}) {
  const t = useT();
  const words = dateWords(t);
  const today = todayInYerevan();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value || (min && min > today ? min : today)));
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function pick(d: string) {
    setOpen(false);
    if (!input.current) return;
    input.current.value = d;
    input.current.form?.requestSubmit();
  }

  const grid = monthGrid(month);
  const shown = value ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : "";
  const arrow = "flex h-8 w-8 items-center justify-center rounded-full border-2 border-line text-lg leading-none text-ink hover:border-spruce-500";

  return (
    <div ref={root} className={`relative ${className}`}>
      <input ref={input} type="hidden" name={name} defaultValue={value} />
      <button
        type="button"
        onClick={() => {
          setMonth(monthOf(value || (min && min > today ? min : today)));
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-full w-full min-w-0 items-center gap-2 text-left focus:outline-none"
      >
        <span className="shrink-0 text-xs font-semibold text-muted">{label}</span>
        <span className={`min-w-0 flex-1 truncate ${shown ? "" : "text-muted"}`}>{shown || "—"}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
          <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
        </svg>
      </button>

      {open && (
        <div role="dialog" aria-label={label} className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-surface p-3 font-normal shadow-xl">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label={t("calendar.prevMonth")} className={arrow}>‹</button>
            <p className="min-w-0 flex-1 text-center text-sm font-bold text-heading">{`${words.months[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`}</p>
            <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label={t("calendar.nextMonth")} className={arrow}>›</button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted">
            {words.weekdaysShort.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.days.map((d) => {
              const off = !!min && d < min;
              const on = d === value;
              const inMonth = d >= grid.first && d <= grid.last;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={off}
                  onClick={() => pick(d)}
                  aria-pressed={on}
                  className={`flex h-9 items-center justify-center rounded-lg border-2 text-[13px] transition ${
                    on
                      ? "border-terracotta-500 bg-terracotta-500 font-bold text-white"
                      : d === today
                        ? "border-spruce-500 font-bold text-ink"
                        : "border-transparent text-ink hover:border-line hover:bg-sand"
                  } ${inMonth ? "" : "opacity-40"} ${off ? "cursor-not-allowed !opacity-25 hover:border-transparent hover:bg-transparent" : ""}`}
                >
                  {+d.slice(8, 10)}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <button
              type="button"
              disabled={!!min && today < min}
              onClick={() => pick(today)}
              className="flex h-8 items-center rounded-full border-2 border-line px-3 text-xs font-semibold text-ink hover:border-spruce-500 disabled:opacity-40"
            >
              {t("calendar.today")}
            </button>
            {value && (
              <button type="button" onClick={() => pick("")} className="text-xs font-semibold text-terracotta-700 hover:text-terracotta-500 dark:text-terracotta-300">
                {t("calendar.clearDate")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
