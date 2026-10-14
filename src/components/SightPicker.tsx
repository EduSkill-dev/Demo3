"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/client";

export type SightOption = { id: string; name: string; region: string; terrain?: string | null; difficulty?: string | null };

// Tick sights from the platform's list: a search box over a scrolling list,
// with the chosen ones shown as removable chips. When regions are picked in
// the same form, their sights come first.
export default function SightPicker({
  sights,
  value,
  onChange,
  regions = [],
}: {
  sights: SightOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  regions?: string[];
}) {
  const t = useT();
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sights
      .filter((s) => !q || s.name.toLowerCase().includes(q) || t(`region.${s.region}`).toLowerCase().includes(q))
      .sort((a, b) => Number(regions.includes(b.region)) - Number(regions.includes(a.region)));
  }, [sights, query, regions, t]);
  const chosen = sights.filter((s) => value.includes(s.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      {chosen.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {chosen.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              title={t("sights.remove")}
              className="rounded-full bg-terracotta-500/15 px-2.5 py-0.5 text-xs font-semibold text-terracotta-700 hover:bg-terracotta-500/25 dark:text-terracotta-300"
            >
              {s.name} ✕
            </button>
          ))}
        </div>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("sights.search")}
        aria-label={t("sights.search")}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-terracotta-500 focus:outline-none"
      />
      <ul className="mt-2 grid max-h-64 gap-x-3 gap-y-1 overflow-y-auto sm:grid-cols-2">
        {shown.map((s) => (
          <li key={s.id}>
            <label className="flex items-start gap-2 rounded-md px-1 py-0.5 text-sm text-ink hover:bg-sand/60">
              <input type="checkbox" checked={value.includes(s.id)} onChange={() => toggle(s.id)} className="mt-1 accent-spruce-500" />
              <span className="min-w-0">
                <span className="block">{s.name}</span>
                <span className="block text-xs text-muted">
                  {t(`region.${s.region}`)}
                  {s.terrain ? ` · ${t(`terrain.${s.terrain}`)}` : ""}
                  {s.difficulty ? ` · ${t(`difficulty.${s.difficulty}`)}` : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="text-sm text-muted">{t("sights.none")}</li>}
      </ul>
    </div>
  );
}
