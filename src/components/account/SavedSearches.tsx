"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useFormatDate, useLocale, useT } from "@/i18n/client";
import { INTL_LOCALE } from "@/i18n/config";
import { REGIONS, TERRAINS } from "@/lib/catalog";

export type SavedSearch = {
  id: string;
  region: string | null;
  sight_id: string | null;
  terrain: string | null;
  club_id: string | null;
  date_from: string | null;
  date_to: string | null;
  overnight: boolean | null;
};

const MAX = 5;

// The list of saved searches (each shown as its conditions, with Delete) and
// the form that adds one. Places are grouped by region in the list.
export default function SavedSearches({
  userId,
  searches,
  sights,
  clubs,
  prefill,
}: {
  userId: string;
  searches: SavedSearch[];
  sights: { id: string; name: string; region: string }[];
  clubs: { id: string; name: string }[];
  prefill: { sight: string; club: string };
}) {
  const t = useT();
  const fmt = useFormatDate();
  const locale = useLocale();
  const router = useRouter();
  const [region, setRegion] = useState("");
  const [sight, setSight] = useState(prefill.sight);
  const [terrain, setTerrain] = useState("");
  const [club, setClub] = useState(prefill.club);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [overnight, setOvernight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sightName = useMemo(() => new Map(sights.map((s) => [s.id, s.name])), [sights]);
  const clubName = useMemo(() => new Map(clubs.map((c) => [c.id, c.name])), [clubs]);
  const grouped = useMemo(() => {
    const collator = new Intl.Collator(INTL_LOCALE[locale], { sensitivity: "base" });
    return REGIONS.map((r) => ({ region: r, list: sights.filter((s) => s.region === r).sort((a, b) => collator.compare(a.name, b.name)) }))
      .filter((g) => g.list.length)
      .sort((a, b) => collator.compare(t(`region.${a.region}`), t(`region.${b.region}`)));
  }, [sights, locale, t]);
  const full = searches.length >= MAX;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (full) return setError(t("searches.limit"));
    if (!region && !sight && !terrain && !club && !from && !to && !overnight) return setError(t("searches.needOne"));
    if (from && to && to < from) return setError(t("searches.badDates"));
    setBusy(true);
    const { error: err } = await createClient()
      .from("saved_searches")
      .insert({
        user_id: userId,
        region: region || null,
        sight_id: sight || null,
        terrain: terrain || null,
        club_id: club || null,
        date_from: from || null,
        date_to: to || null,
        overnight: overnight === "" ? null : overnight === "yes",
      });
    setBusy(false);
    if (err) return setError(serverErrorMessage(t, err.message));
    setRegion("");
    setSight("");
    setTerrain("");
    setClub("");
    setFrom("");
    setTo("");
    setOvernight("");
    setNotice(t("searches.saved"));
    router.refresh();
  }

  async function remove(id: string) {
    setError(null);
    const { error: err } = await createClient().from("saved_searches").delete().eq("id", id).eq("user_id", userId);
    if (err) return setError(serverErrorMessage(t, err.message));
    router.refresh();
  }

  const conditions = (s: SavedSearch) =>
    [
      s.club_id && `${t("searches.club")}: ${clubName.get(s.club_id) ?? "—"}`,
      s.sight_id && `${t("searches.place")}: ${sightName.get(s.sight_id) ?? "—"}`,
      s.region && `${t("searches.region")}: ${t(`region.${s.region}`)}`,
      s.terrain && `${t("searches.kind")}: ${t(`terrain.${s.terrain}`)}`,
      s.date_from && s.date_to
        ? t("searches.dates", { from: fmt(s.date_from, "short"), to: fmt(s.date_to, "short") })
        : s.date_from
          ? t("searches.fromOnly", { from: fmt(s.date_from, "short") })
          : s.date_to
            ? t("searches.toOnly", { to: fmt(s.date_to, "short") })
            : null,
      s.overnight !== null && (s.overnight ? t("searches.overnightYes") : t("searches.overnightNo")),
    ].filter((x): x is string => !!x);

  const field = (on: boolean) =>
    `mt-1 h-10 w-full min-w-0 rounded-lg border-2 bg-surface px-2.5 text-sm text-ink focus:outline-none ${on ? "border-terracotta-500 font-semibold" : "border-line"}`;
  const label = "min-w-0 text-xs font-semibold text-muted";

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-2 text-sm font-semibold text-muted">{t("searches.count", { count: searches.length })}</p>
        {searches.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted">{t("searches.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {searches.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-3">
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {conditions(s).map((c) => (
                    <span key={c} className="inline-flex h-7 items-center rounded-full bg-sand px-3 text-xs font-semibold leading-none text-ink">{c}</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink hover:border-terracotta-500 hover:text-terracotta-700"
                >
                  {t("searches.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={add} className="rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={label}>
            {t("searches.club")}
            <select value={club} onChange={(e) => setClub(e.target.value)} className={field(!!club)}>
              <option value="">{t("searches.any")}</option>
              {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className={label}>
            {t("searches.region")}
            <select value={region} onChange={(e) => setRegion(e.target.value)} className={field(!!region)}>
              <option value="">{t("searches.any")}</option>
              {REGIONS.map((r) => <option key={r} value={r}>{t(`region.${r}`)}</option>)}
            </select>
          </label>
          <label className={label}>
            {t("searches.place")}
            <select value={sight} onChange={(e) => setSight(e.target.value)} className={field(!!sight)}>
              <option value="">{t("searches.any")}</option>
              {grouped.map((g) => (
                <optgroup key={g.region} label={t(`region.${g.region}`)}>
                  {g.list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={label}>
            {t("searches.kind")}
            <select value={terrain} onChange={(e) => setTerrain(e.target.value)} className={field(!!terrain)}>
              <option value="">{t("searches.any")}</option>
              {TERRAINS.map((k) => <option key={k} value={k}>{t(`terrain.${k}`)}</option>)}
            </select>
          </label>
          <label className={label}>
            {t("searches.from")}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field(!!from)} />
          </label>
          <label className={label}>
            {t("searches.to")}
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={field(!!to)} />
          </label>
          <label className={label}>
            {t("searches.overnight")}
            <select value={overnight} onChange={(e) => setOvernight(e.target.value)} className={field(!!overnight)}>
              <option value="">{t("searches.any")}</option>
              <option value="yes">{t("searches.overnightYes")}</option>
              <option value="no">{t("searches.overnightNo")}</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || full}
            className="rounded-full bg-spruce-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900 disabled:opacity-50"
          >
            {t("searches.add")}
          </button>
          {full && <span className="text-sm text-muted">{t("searches.limit")}</span>}
          {notice && <span className="text-sm font-semibold text-spruce-700 dark:text-spruce-300">{notice}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}
