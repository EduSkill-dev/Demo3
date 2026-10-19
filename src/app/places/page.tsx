import type { Metadata } from "next";
import Link from "next/link";
import { getPlaces } from "@/lib/places";
import { DIFFICULTIES, REGIONS, TERRAINS } from "@/lib/catalog";
import { getLocale, getT } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import AutoSubmitForm from "@/components/calendar/AutoSubmitForm";
import PlaceCard from "@/components/places/PlaceCard";

type Params = Record<string, string | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Params }): Promise<Metadata> {
  const t = await getT();
  // The plain page is indexed; filtered views of it are not.
  const filtered = Object.values(searchParams).some(Boolean);
  return { title: t("placesPage.title"), description: t("placesPage.intro"), ...(filtered ? { robots: { index: false, follow: true } } : {}) };
}

const PAGE = 12;

// Every place the hikes go to, as cards: the most popular first (hearts,
// then hikes), or by name. Filters by kind (chips, several at once), region
// and difficulty;
// twelve at a time, "show more" adds twelve. Everything lives in the URL.
export default async function PlacesPage({ searchParams }: { searchParams: Params }) {
  const [t, locale, all] = await Promise.all([getT(), getLocale(), getPlaces()]);
  const pick = (list: readonly string[], v?: string) => (list.includes(v ?? "") ? v! : "");
  // Kinds chosen together show places of any of them ("lakes,mountains").
  const chosen = (searchParams.kind ?? "").split(",").filter((k) => (TERRAINS as readonly string[]).includes(k));
  const kind = TERRAINS.filter((k) => chosen.includes(k)).join(",");
  const region = pick(REGIONS, searchParams.region);
  const difficulty = pick(DIFFICULTIES, searchParams.difficulty);
  const sort = searchParams.sort === "name" ? "name" : "popular";
  const show = Math.min(Math.max(PAGE, Math.round(Number(searchParams.show) / PAGE) * PAGE || PAGE), 600);

  const collator = new Intl.Collator(INTL_LOCALE[locale], { sensitivity: "base" });
  const found = all
    .filter((p) => (!chosen.length || chosen.includes(p.terrain ?? "")) && (!region || p.region === region) && (!difficulty || p.difficulty === difficulty))
    .sort((a, b) => (sort === "popular" ? b.likes - a.likes || b.hikes - a.hikes || b.upcoming - a.upcoming : 0) || collator.compare(a.name, b.name));
  const shown = found.slice(0, show);

  const state: Record<string, string> = { kind, region, difficulty, sort: sort === "name" ? "name" : "" };
  const href = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/places?${s}` : "/places";
  };
  const kinds = TERRAINS.filter((k) => all.some((p) => p.terrain === k));
  const chipCls = (on: boolean) =>
    `flex h-9 shrink-0 items-center rounded-full border-2 px-4 text-sm font-semibold transition ${
      on ? "border-spruce-500 bg-spruce-500 text-[#FFFDF8]" : "border-line bg-surface text-ink hover:border-spruce-500"
    }`;
  const field = (on: boolean) =>
    `h-9 w-full min-w-0 rounded-lg border-2 bg-surface px-2.5 text-sm text-ink focus:outline-none ${on ? "border-terracotta-500 font-semibold" : "border-line"}`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold text-heading">{t("placesPage.title")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t("placesPage.intro")}</p>

      <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 lg:flex-row lg:items-stretch">
        {/* Left: the kinds (each tap adds or removes one) and, under them, the
            selects, as wide as the row of kinds. */}
        <div className="min-w-0 lg:w-fit lg:max-w-full">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <Link href={href({ kind: "" })} scroll={false} className={chipCls(!chosen.length)}>
              {t("placesPage.all")}
            </Link>
            {kinds.map((k) => {
              const on = chosen.includes(k);
              const next = TERRAINS.filter((x) => (x === k ? !on : chosen.includes(x))).join(",");
              return (
                <Link key={k} href={href({ kind: next })} scroll={false} aria-pressed={on} className={chipCls(on)}>
                  {t(`terrain.${k}`)}
                </Link>
              );
            })}
          </div>
          <AutoSubmitForm action="/places" className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-3">
            {kind && <input type="hidden" name="kind" value={kind} />}
            <select name="region" defaultValue={region} aria-label={t("placesPage.region")} className={field(!!region)}>
              <option value="">{t("placesPage.region")}</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {t(`region.${r}`)}
                </option>
              ))}
            </select>
            <select name="difficulty" defaultValue={difficulty} aria-label={t("placesPage.difficulty")} className={field(!!difficulty)}>
              <option value="">{t("placesPage.difficulty")}</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {t(`difficulty.${d}`)}
                </option>
              ))}
            </select>
            <select name="sort" defaultValue={sort === "name" ? "name" : ""} aria-label={t("placesPage.sort")} className={field(false)}>
              <option value="">{t("placesPage.sortPopular")}</option>
              <option value="name">{t("placesPage.sortName")}</option>
            </select>
            <button type="submit" className="sr-only">
              {t("calendar.apply")}
            </button>
          </AutoSubmitForm>
        </div>
        {/* Right: how many were found, in the middle of the free space. */}
        <span className="flex flex-1 items-center justify-center py-1"><span className="rounded-full bg-apricot-100 px-3.5 py-1 text-[15px] font-bold text-apricot-700 dark:bg-apricot-500/20 dark:text-apricot-300">{t("placesPage.found", { count: found.length })}</span></span>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-8 text-center text-muted">{t("placesPage.empty")}</p>
      ) : (
        <div className="mt-6 grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <PlaceCard key={p.id} place={p} t={t} />
          ))}
        </div>
      )}

      {found.length > shown.length && (
        <div className="mt-6 flex justify-center">
          <Link
            href={href({ show: String(show + PAGE) })}
            scroll={false}
            className="rounded-lg border-2 border-spruce-900 px-6 py-2.5 text-sm font-semibold text-ink hover:bg-spruce-900 hover:text-card dark:border-ink dark:hover:bg-ink dark:hover:text-spruce-900"
          >
            {t("placesPage.showMore")}
          </Link>
        </div>
      )}
    </main>
  );
}
