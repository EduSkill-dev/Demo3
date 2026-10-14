"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

const compact = (iso: string) => iso.replace(/-/g, "");
const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// "Add to my calendar" for one hike: a small menu — Google Calendar and
// Outlook open with the hike filled in; Apple and other calendars take the
// .ics file. All-day events (hikes have dates, not times).
export default function AddToCalendar({
  tour,
  className,
  compactButton = false,
}: {
  tour: { id: string; title: string; date: string; end_date: string | null; place: string; club: string };
  className?: string;
  compactButton?: boolean; // an icon only
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const last = tour.end_date && tour.end_date > tour.date ? tour.end_date : tour.date;
  const page = typeof window === "undefined" ? `/tours/${tour.id}` : `${window.location.origin}/tours/${tour.id}`;
  const text = `${tour.title} · ${tour.club}`;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${compact(tour.date)}/${compact(nextDay(last))}&details=${encodeURIComponent(page)}&location=${encodeURIComponent(tour.place)}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&allday=true&subject=${encodeURIComponent(text)}&startdt=${tour.date}&enddt=${nextDay(last)}&body=${encodeURIComponent(page)}&location=${encodeURIComponent(tour.place)}`;
  const item = "block w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-sand";

  return (
    <div ref={box} className="relative">
      <button
        data-view
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("calendar.addToMine")}
        aria-label={t("calendar.addToMine")}
        onClick={() => setOpen((o) => !o)}
        className={className}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5" />
        </svg>
        {!compactButton && <span>{t("calendar.addToMine")}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <p className="border-b border-line px-4 py-2 text-xs font-semibold text-muted">{t("calendar.whichCalendar")}</p>
          <a role="menuitem" href={google} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>Google Calendar</a>
          <a role="menuitem" href={outlook} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>Outlook</a>
          <a role="menuitem" href={`/tours/${tour.id}/calendar.ics`} className={item} onClick={() => setOpen(false)}>{t("calendar.appleOther")}</a>
        </div>
      )}
    </div>
  );
}
