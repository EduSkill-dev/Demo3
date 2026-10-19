"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DIFFICULTIES, REGIONS, TERRAINS } from "@/lib/catalog";
import { useT } from "@/i18n/client";
import type { Sight } from "@/lib/sights";
import { uploadImage, IMAGE_ACCEPT } from "@/lib/storage";
import { adminAction, adminButton, adminGhost, adminInlineInput, adminInput } from "./adminApi";
import { SortButton, sortRows, type SortState } from "./Sortable";
import InfoTip from "@/components/ui/InfoTip";

type Draft = {
  id: string | null; name_hy: string; name_ru: string; name_en: string; region: string; terrain: string; difficulty: string; active: boolean;
  photo_url: string; description_hy: string; description_ru: string; description_en: string;
  elevation: string; // whole metres, "" = not set
};
const blank: Draft = {
  id: null, name_hy: "", name_ru: "", name_en: "", region: REGIONS[0], terrain: TERRAINS[0], difficulty: "medium", active: true,
  photo_url: "", description_hy: "", description_ru: "", description_en: "", elevation: "",
};
const toDraft = (s: Sight, patch: Partial<Draft> = {}): Draft => ({
  id: s.id, name_hy: s.name_hy, name_ru: s.name_ru, name_en: s.name_en, region: s.region,
  terrain: s.terrain ?? TERRAINS[0], difficulty: s.difficulty ?? "medium", active: s.active,
  photo_url: s.photo_url ?? "", description_hy: s.description_hy ?? "", description_ru: s.description_ru ?? "", description_en: s.description_en ?? "",
  elevation: s.elevation === null || s.elevation === undefined ? "" : String(s.elevation),
  ...patch,
});

// Add, rename and hide sights, with a photo and a few words per language for
// the place's public page. One line per sight; the form on top edits the
// chosen one or adds a new one.
export default function SightsManager({ sights }: { sights: Sight[] }) {
  const t = useT(); // region names only; the admin area itself is Armenian
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(blank);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Names A–Z at first; a header click sorts by that column, again reverses.
  const [sort, setSort] = useState<SortState>({ col: "name", dir: "asc" });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = sights.filter((s) => !q || `${s.name_hy} ${s.name_ru} ${s.name_en} ${t(`region.${s.region}`)}`.toLowerCase().includes(q));
    return sortRows(found, {
      name: (s) => s.name_hy,
      region: (s) => t(`region.${s.region}`),
      terrain: (s) => (s.terrain ? t(`terrain.${s.terrain}`) : null),
      difficulty: (s) => (s.difficulty ? DIFFICULTIES.indexOf(s.difficulty as (typeof DIFFICULTIES)[number]) : null),
      elevation: (s) => s.elevation,
    }, sort);
  }, [sights, query, t, sort]);

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

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    const up = await uploadImage("places", file);
    setBusy(false);
    if ("error" in up) return setError(up.error);
    set({ photo_url: up.url });
  }

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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          <div>
            <label htmlFor="sight-terrain" className="mb-1 block text-sm font-medium text-ink">Տեսակ</label>
            <select id="sight-terrain" value={draft.terrain} onChange={(e) => set({ terrain: e.target.value })} className={adminInput}>
              {TERRAINS.map((k) => (
                <option key={k} value={k}>{t(`terrain.${k}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sight-difficulty" className="mb-1 block text-sm font-medium text-ink">Բարդություն</label>
            <select id="sight-difficulty" value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value })} className={adminInput}>
              {DIFFICULTIES.map((k) => (
                <option key={k} value={k}>{t(`difficulty.${k}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sight-elevation" className="mb-1 block text-sm font-medium text-ink">Բարձրություն (մ)</label>
            <input
              id="sight-elevation"
              type="number"
              inputMode="numeric"
              step={1}
              min={-500}
              max={9000}
              placeholder="օր.՝ 2597"
              value={draft.elevation}
              onChange={(e) => set({ elevation: e.target.value.replace(/[^\d-]/g, "") })}
              className={adminInput}
            />
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <div>
            <span className="mb-1 block text-sm font-medium text-ink">
              Նկար
              <InfoTip text="Հորիզոնական նկար՝ 4:3 կամ 3:2 հարաբերությամբ, առնվազն 1600 պիքսել լայնությամբ։ Կայքը նկարը կփոքրացնի մինչև 1600px, իսկ քարտերում ավտոմատ կկտրի կենտրոնից, ուստի գլխավորը թող լինի նկարի մեջտեղում։" />
            </span>
            {draft.photo_url ? (
              <img src={draft.photo_url} alt="" className="h-32 w-full rounded-lg object-cover" />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">Նկար չկա (ցույց կտրվի արշավի վերջին նկարը)</div>
            )}
            <div className="mt-2 flex gap-2">
              <label className={`${adminGhost} cursor-pointer !px-2 !py-1 text-xs`}>
                {draft.photo_url ? "Փոխել" : "Բեռնել"}
                <input type="file" accept={IMAGE_ACCEPT} onChange={pickPhoto} className="sr-only" />
              </label>
              {draft.photo_url && (
                <button type="button" className={`${adminGhost} !px-2 !py-1 text-xs`} onClick={() => set({ photo_url: "" })}>
                  Հեռացնել
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["hy", "ru", "en"] as const).map((l) => (
              <div key={l}>
                <label htmlFor={`sight-desc-${l}`} className="mb-1 block text-sm font-medium text-ink">
                  Նկարագրություն ({l === "hy" ? "հայերեն" : l === "ru" ? "ռուսերեն" : "անգլերեն"})
                </label>
                <textarea
                  id={`sight-desc-${l}`}
                  rows={5}
                  maxLength={1500}
                  value={draft[`description_${l}`]}
                  onChange={(e) => set({ [`description_${l}`]: e.target.value } as Partial<Draft>)}
                  className={adminInput}
                />
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">Տեսակն ու բարդությունը ավտոմատ անցնում են այս վայրն ընտրած հայտարարություններին (արշավի բարդությունը՝ ամենաբարդ վայրինը)։</p>
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
                <th className="whitespace-nowrap px-3 py-2.5"><SortButton label="Անվանում" col="name" sort={sort} onSort={setSort} /></th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center"><SortButton label="Մարզ" col="region" sort={sort} onSort={setSort} /></th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center"><SortButton label="Տեսակ" col="terrain" sort={sort} onSort={setSort} /></th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center"><SortButton label="Բարդություն" col="difficulty" sort={sort} onSort={setSort} /></th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center"><SortButton label="Բարձր." col="elevation" sort={sort} onSort={setSort} /></th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center">Վիճակ</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">Գործողություններ</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">Վայր չի գտնվել։</td>
                </tr>
              )}
              {shown.map((s) => (
                <tr key={s.id} className={`border-b border-line last:border-0 ${s.active ? "" : "opacity-60"}`}>
                  <td className="px-3 py-2">
                    <span className="block font-medium text-ink">{s.name_hy}</span>
                    <span className="block text-xs text-muted">{s.name_ru} · {s.name_en}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-center text-muted">{t(`region.${s.region}`)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center text-muted">{s.terrain ? t(`terrain.${s.terrain}`) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center text-muted">{s.difficulty ? t(`difficulty.${s.difficulty}`) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center text-muted">{s.elevation ?? "—"}</td>
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
                      <button type="button" disabled={busy} className={`${adminGhost} !px-2 !py-1`} onClick={() => setDraft(toDraft(s))}>
                        Խմբագրել
                      </button>
                      <button type="button" disabled={busy} className={`${adminGhost} !px-2 !py-1`} onClick={() => save(toDraft(s, { terrain: s.terrain ?? "other", active: !s.active }))}>
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
