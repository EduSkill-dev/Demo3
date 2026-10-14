"use client";

import { useMemo, useState } from "react";
import { useLocale, useT } from "@/i18n/client";
import { INTL_LOCALE } from "@/i18n/config";

export type SightOption = { id: string; name: string; region: string; terrain?: string | null; difficulty?: string | null };

// Tick sights from the platform's list: a search box over a scrolling list,
// with the chosen ones shown as removable chips. The list is grouped by
// region — regions in alphabetical order, and the places of each region in
// alphabetical order. When regions are picked in the same form, their groups
// come first.
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
  const locale = useLocale();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const collator = new Intl.Collator(INTL_LOCALE[locale], { sensitivity: "base", numeric: true });
    const q = query.trim().toLowerCase();
    const byRegion = new Map<string, SightOption[]>();
    for (const s of sights) {
      if (q && !s.name.toLowerCase().includes(q) && !t(`region.${s.region}`).toLowerCase().includes(q)) continue;
      byRegion.set(s.region, [...(byRegion.get(s.region) ?? []), s]);
    }
    return [...byRegion.entries()]
      .map(([region, list]) => ({ region, label: t(`region.${region}`), list: list.sort((a, b) => collator.compare(a.name, b.name)) }))
      .sort((a, b) => Number(regions.includes(b.region)) - Number(regions.includes(a.region)) || collator.compare(a.label, b.label));
  }, [sights, query, regions, t, locale]);
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
      <div className="mt-2 max-h-72 overflow-y-auto">
        {groups.map((g) => (
          <section key={g.region}>
            <h4 className="sticky top-0 z-10 bg-surface px-1 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-spruce-700 dark:text-spruce-300">
              {g.label}
            </h4>
            <ul className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
              {g.list.map((s) => (
                <li key={s.id}>
                  <label className="flex items-start gap-2 rounded-md px-1 py-0.5 text-sm text-ink hover:bg-sand/60">
                    <input type="checkbox" checked={value.includes(s.id)} onChange={() => toggle(s.id)} className="mt-1 accent-spruce-500" />
                    <span className="min-w-0">
                      <span className="block">{s.name}</span>
                      {(s.terrain || s.difficulty) && (
                        <span className="block text-xs text-muted">
                          {[s.terrain && t(`terrain.${s.terrain}`), s.difficulty && t(`difficulty.${s.difficulty}`)].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted">{t("sights.none")}</p>}
      </div>
    </div>
  );
}
