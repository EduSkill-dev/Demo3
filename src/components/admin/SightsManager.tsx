"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { REGIONS } from "@/lib/catalog";
import { useT } from "@/i18n/client";
import type { Sight } from "@/lib/sights";
import { adminAction, adminButton, adminGhost, adminInlineInput, adminInput } from "./adminApi";

type Draft = { id: string | null; name_hy: string; name_ru: string; name_en: string; region: string; active: boolean };
const blank: Draft = { id: null, name_hy: "", name_ru: "", name_en: "", region: REGIONS[0], active: true };

// Add, rename and hide sights. One line per sight; the form on top edits the
// chosen one or adds a new one.
export default function SightsManager({ sights }: { sights: Sight[] }) {
  const t = useT(); // region names only; the admin area itself is Armenian
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(blank);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sights.filter((s) => !q || `${s.name_hy} ${s.name_ru} ${s.name_en} ${t(`region.${s.region}`)}`.toLowerCase().includes(q));
  }, [sights, query, t]);

  async function save(body: Draft) {
    setBusy(true);
    setError(null);
    const res = await adminAction({ action: "sight.save", ...body });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setDraft(blank);
    router.refresh();
  }
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(draft);
        }}
        className="space-y-3 rounded-xl border border-line bg-surface p-5"
      >
        <h3 className="font-serif text-lg font-semibold text-heading">{draft.id ? "Խմբագրել վայրը" : "Նոր տեսարժան վայր"}</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label htmlFor="sight-hy" className="mb-1 block text-sm font-medium text-ink">Անվանումը հայերեն</label>
            <input id="sight-hy" required value={draft.name_hy} onChange={(e) => set({ name_hy: e.target.value })} className={adminInput} />
          </div>
          <div>
            <label htmlFor="sight-ru" className="mb-1 block text-sm font-medium text-ink">Ռուսերեն</label>
            <input id="sight-ru" required value={draft.name_ru} onChange={(e) => set({ name_ru: e.target.value })} className={adminInput} />
          </div>
          <div>
            <label htmlFor="sight-en" className="mb-1 block text-sm font-medium text-ink">Անգլերեն</label>
            <input id="sight-en" required value={draft.name_en} onChange={(e) => set({ name_en: e.target.value })} className={adminInput} />
          </div>
          <div>
            <label htmlFor="sight-region" className="mb-1 block text-sm font-medium text-ink">Մարզ</label>
            <select id="sight-region" value={draft.region} onChange={(e) => set({ region: e.target.value })} className={adminInput}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{t(`region.${r}`)}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={adminButton}>
            {busy ? "..." : draft.id ? "Պահպանել" : "Ավելացնել"}
          </button>
          {draft.id && (
            <button type="button" className={adminGhost} onClick={() => setDraft(blank)}>
              Չեղարկել
            </button>
          )}
        </div>
      </form>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold text-heading">Տեսարժան վայրեր ({shown.length})</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Փնտրել ըստ անվան կամ մարզի"
            aria-label="Փնտրել"
            className={`${adminInlineInput} w-64 max-w-full`}
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5">Հայերեն</th>
                <th className="whitespace-nowrap px-3 py-2.5">Ռուսերեն</th>
                <th className="whitespace-nowrap px-3 py-2.5">Անգլերեն</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center">Մարզ</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center">Վիճակ</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">Գործողություններ</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted">Վայր չի գտնվել։</td>
                </tr>
              )}
              {shown.map((s) => (
                <tr key={s.id} className={`border-b border-line last:border-0 ${s.active ? "" : "opacity-60"}`}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">{s.name_hy}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{s.name_ru}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{s.name_en}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center text-muted">{t(`region.${s.region}`)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        s.active ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" : "bg-sand text-muted"
                      }`}
                    >
                      {s.active ? "Ցուցադրվում է" : "Թաքցված"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" disabled={busy} className={`${adminGhost} !px-2 !py-1`} onClick={() => setDraft({ ...s })}>
                        Խմբագրել
                      </button>
                      <button type="button" disabled={busy} className={`${adminGhost} !px-2 !py-1`} onClick={() => save({ ...s, active: !s.active })}>
                        {s.active ? "Թաքցնել" : "Ցուցադրել"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
