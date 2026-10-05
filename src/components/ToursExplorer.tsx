"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DIFFICULTIES, REGIONS, TERRAINS } from "@/lib/catalog";
import { useT } from "@/i18n/client";
import type { PublicTour } from "@/lib/publicTours";
import TourCard from "@/components/tour/TourCard";
import TourQuickView from "@/components/tour/TourQuickView";

const KEYS = ["region", "terrain", "club", "difficulty", "from", "to", "overnight"] as const;
type Key = (typeof KEYS)[number];

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-apricot focus:outline-none focus:ring-2 focus:ring-apricot/20";

// Filters live in the URL (?region=…&terrain=…), so the club page's "Back"
// and the browser's own back button return to the same selection.
export default function ToursExplorer({
  tours,
  clubs,
}: {
  tours: PublicTour[];
  clubs: { id: string; name: string }[]; // every registered club, alphabetical
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<PublicTour | null>(null);

  const get = (k: Key) => params.get(k) ?? "";
  function set(patch: Partial<Record<Key, string>>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const filtered = useMemo(() => {
    const f = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ""])) as Record<Key, string>;
    return tours.filter(
      (x) =>
        (!f.region || x.regions.includes(f.region)) &&
        (!f.terrain || x.terrains.includes(f.terrain)) &&
        (!f.club || x.club_id === f.club) &&
        (!f.difficulty || x.difficulty === f.difficulty) &&
        (!f.from || x.date >= f.from) &&
        (!f.to || x.date <= f.to) &&
        (!f.overnight || x.overnight)
    );
  }, [tours, params]);

  const active = KEYS.some((k) => params.get(k));
  const here = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <div>
      <div data-view className="rounded-2xl border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-muted">
            {t("toursPage.region")}
            <select value={get("region")} onChange={(e) => set({ region: e.target.value })} className={`${field} mt-1`}>
              <option value="">{t("toursPage.any")}</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{t(`region.${r}`)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            {t("toursPage.terrain")}
            <select value={get("terrain")} onChange={(e) => set({ terrain: e.target.value })} className={`${field} mt-1`}>
              <option value="">{t("toursPage.any")}</option>
              {TERRAINS.map((k) => (
                <option key={k} value={k}>{t(`terrain.${k}`)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            {t("toursPage.club")}
            <select value={get("club")} onChange={(e) => set({ club: e.target.value })} className={`${field} mt-1`}>
              <option value="">{t("toursPage.any")}</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            {t("toursPage.difficulty")}
            <select value={get("difficulty")} onChange={(e) => set({ difficulty: e.target.value })} className={`${field} mt-1`}>
              <option value="">{t("toursPage.any")}</option>
              {DIFFICULTIES.map((k) => (
                <option key={k} value={k}>{t(`difficulty.${k}`)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            {t("toursPage.from")}
            <input type="date" value={get("from")} onChange={(e) => set({ from: e.target.value })} className={`${field} mt-1`} />
          </label>
          <label className="text-xs font-semibold text-muted">
            {t("toursPage.to")}
            <input type="date" value={get("to")} min={get("from") || undefined} onChange={(e) => set({ to: e.target.value })} className={`${field} mt-1`} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-ink">
            <input type="checkbox" checked={!!get("overnight")} onChange={(e) => set({ overnight: e.target.checked ? "1" : "" })} className="accent-apricot" />
            🌙 {t("toursPage.overnightOnly")}
          </label>
          <div className="flex items-end justify-between gap-3 pb-1 text-sm">
            <span className="text-muted">{t("toursPage.results", { count: filtered.length })}</span>
            {active && (
              <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="font-semibold text-apricot hover:text-apricot-dark">
                {t("toursPage.clear")}
              </button>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-muted">{t("toursPage.empty")}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tour) => (
            <TourCard
              key={tour.id}
              tour={tour}
              backHref={here}
              onRegion={(region) => set({ region })}
              onOpen={() => setOpen(tour)}
            />
          ))}
        </div>
      )}

      <TourQuickView tour={open} onClose={() => setOpen(null)} />
    </div>
  );
}
