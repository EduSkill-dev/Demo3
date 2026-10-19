"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

// A time field in the site's look: tap the hour, then the minutes (every 5),
// instead of the browser's spinning wheel that skips past the wanted number.
// Controlled ("HH:MM" or ""); `required` keeps the browser's own check.
export default function TimeField({
  id,
  value,
  onChange,
  required = false,
  className = "",
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [h, m] = value ? value.slice(0, 5).split(":") : ["", ""];

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

  const cell = (on: boolean) =>
    `flex h-9 items-center justify-center rounded-lg border-2 text-[13px] font-semibold transition ${
      on ? "border-terracotta-500 bg-terracotta-500 text-white" : "border-transparent bg-sand/60 text-ink hover:border-line hover:bg-sand"
    }`;

  return (
    <div ref={root} className={`relative ${className}`}>
      <input tabIndex={-1} aria-hidden="true" required={required} value={value} onChange={() => {}} className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" />
      <button
        id={id}
        type="button"
        onClick={() => {
          const r = root.current?.getBoundingClientRect();
          setAlignRight(!!r && r.left + 300 > window.innerWidth - 8);
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-full w-full min-w-0 items-center gap-2 text-left focus:outline-none"
      >
        <span className={`min-w-0 flex-1 truncate ${value ? "" : "text-muted"}`}>{value ? value.slice(0, 5) : placeholder || "—"}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 5.5V10l3 2" />
        </svg>
      </button>

      {open && (
        <div role="dialog" aria-label={placeholder} className={`absolute ${alignRight ? "right-0" : "left-0"} top-full z-50 mt-2 w-[18.5rem] rounded-2xl border border-line bg-surface p-3 font-normal shadow-xl`}>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("time.hour")}</p>
          <div className="mt-1.5 grid grid-cols-6 gap-1">
            {HOURS.map((x) => (
              <button key={x} type="button" aria-pressed={x === h} onClick={() => onChange(`${x}:${m || "00"}`)} className={cell(x === h)}>
                {x}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">{t("time.minutes")}</p>
          <div className="mt-1.5 grid grid-cols-6 gap-1">
            {MINUTES.map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={x === m}
                onClick={() => {
                  onChange(`${h || "08"}:${x}`);
                  setOpen(false);
                }}
                className={cell(x === m)}
              >
                :{x}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm font-bold text-heading">{value ? value.slice(0, 5) : "—"}</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-spruce-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-spruce-900">
              {t("time.done")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
