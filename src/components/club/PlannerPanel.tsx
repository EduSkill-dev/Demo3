"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { DIFFICULTY_COLORS } from "@/lib/calendar";
import type { Difficulty } from "@/types/database";

type Item = { id: string; title: string; club?: string; date: string; endDate: string | null; regions: string[]; difficulty: Difficulty };

// In the tour form, once a date is chosen: what other clubs already have on
// that day (and the club's own hikes). It only informs — saving is never
// blocked by it.
export default function PlannerPanel({ date, endDate, regions, exclude }: { date: string; endDate: string; regions: string[]; exclude?: string }) {
  const t = useT();
  const [data, setData] = useState<{ others: Item[]; own: Item[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setData(null);
    let stale = false;
    const timer = setTimeout(async () => {
      const q = new URLSearchParams({ date });
      if (endDate && endDate > date) q.set("end", endDate);
      if (exclude) q.set("exclude", exclude);
      const res = await fetch(`/api/planner?${q}`).catch(() => null);
      if (stale) return;
      if (!res?.ok) return setFailed(true);
      setFailed(false);
      setData((await res.json()) as { others: Item[]; own: Item[] });
    }, 350);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [date, endDate, exclude]);

  if (!data || failed) return null;

  const chip = (level: Difficulty) => (
    <span className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: DIFFICULTY_COLORS[level].bg, color: DIFFICULTY_COLORS[level].text }}>
      {t(`difficulty.${level}`)}
    </span>
  );
  const names = (keys: string[]) => keys.map((r) => t(`region.${r}`)).join(", ");
  const sameRegion = data.others.filter((x) => x.regions.some((r) => regions.includes(r)));

  return (
    <aside className="rounded-xl border border-line bg-sand/60 p-4 text-sm sm:col-span-2" aria-live="polite">
      <h3 className="font-semibold text-heading">{t("planner.title")}</h3>
      {data.others.length === 0 ? (
        <p className="mt-1.5 text-muted">{t("planner.empty")}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {data.others.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink">
              <span className="font-medium">{x.club}</span>
              <span className="text-muted">· {names(x.regions)}</span>
              {chip(x.difficulty)}
            </li>
          ))}
        </ul>
      )}
      {sameRegion.length > 0 && (
        <p className="mt-2.5 rounded-lg bg-apricot-100 px-3 py-2 text-[13px] text-apricot-700">
          {t("planner.sameRegion", { list: sameRegion.map((x) => `${x.club} (${names(x.regions.filter((r) => regions.includes(r)))})`).join(", ") })}
        </p>
      )}
      {data.own.length > 0 && (
        <p className="mt-2.5 text-[13px] text-muted">
          {t("planner.own", { list: data.own.map((x) => x.title).join(", ") })}
        </p>
      )}
    </aside>
  );
}
