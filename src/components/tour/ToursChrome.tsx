import Link from "next/link";
import { DIFFICULTIES, REGIONS, TERRAINS } from "@/lib/catalog";
import { getT } from "@/i18n/server";
import type { TFunction } from "@/i18n/translate";
import { getViewer } from "@/lib/viewer";
import { isDay, todayInYerevan } from "@/lib/calendar";
import AutoSubmitForm from "@/components/calendar/AutoSubmitForm";
import DateField from "@/components/ui/DateField";
import FilterPanel from "@/components/tour/FilterPanel";

// The filters both views of the Tours page share. They have the same names
// in both, so switching between the list and the calendar keeps them.
export type TourFilters = {
  region: string;
  terrain: string;
  club: string;
  difficulty: string;
  from: string; // "" when not set
  to: string;
  overnight: boolean;
  free: boolean;
};

export function filterQuery(f: TourFilters): Record<string, string> {
  return {
    region: f.region, terrain: f.terrain, club: f.club, difficulty: f.difficulty,
    from: f.from, to: f.to, overnight: f.overnight ? "1" : "", free: f.free ? "1" : "",
  };
}

const toQuery = (path: string, params: Record<string, string>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
};

// The title, the list | calendar switch and, for clubs, "new listing" — the
// same on both views, so only the part under the filters changes.
export async function ToursHeader() {
  const t = await getT();
  const viewer = await getViewer();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-heading">{t("toursPage.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t("calendar.subtitle")}</p>
      </div>
      {viewer?.role === "club" && (
        <Link href="/dashboard/listings/new" className="rounded-lg bg-spruce-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900">
          {t("announcements.new")}
        </Link>
      )}
    </div>
  );
}

// List | calendar, sized to one row of the filter box. Switching keeps the
// filters; the calendar opens on today when no dates are set, so the filter
// and the month show the same thing.
function ViewSwitch({ view, filters, t }: { view: "list" | "calendar"; filters: TourFilters; t: TFunction }) {
  const segment = (on: boolean) =>
    `flex h-8 items-center rounded-full px-4 text-sm font-semibold ${on ? "bg-spruce-500 text-[#FFFDF8]" : "text-ink hover:text-terracotta-700"}`;
  const q = filterQuery(filters);
  const calendarQ = q.from || q.to ? q : { ...q, from: todayInYerevan(), to: todayInYerevan() };
  return (
    <div className="flex shrink-0 rounded-full bg-sand p-0.5">
      {view === "list" ? (
        <span className={segment(true)} aria-current="page">{t("calendar.switchList")}</span>
      ) : (
        <Link href={toQuery("/tours", q)} rel="nofollow" className={segment(false)}>{t("calendar.switchList")}</Link>
      )}
      {view === "calendar" ? (
        <span className={segment(true)} aria-current="page">{t("calendar.switchCalendar")}</span>
      ) : (
        <Link href={toQuery("/calendar", calendarQ)} rel="nofollow" className={segment(false)}>{t("calendar.switchCalendar")}</Link>
      )}
    </div>
  );
}

// The filter box: two compact rows, the field's name standing in for "any",
// a set filter outlined in orange; on the right how many hikes were found
// and a clear button that stands out.
export async function ToursFilters({
  action,
  view,
  filters,
  clubs,
  count,
  minDate,
  hidden = {},
  clearHref,
}: {
  action: "/tours" | "/calendar";
  view: "list" | "calendar";
  filters: TourFilters;
  clubs: { id: string; name: string }[];
  count: number;
  minDate?: string;
  hidden?: Record<string, string>; // state the form keeps (the month, the day)
  clearHref?: string; // where "Clear" leads (default: the page with the hidden state only)
}) {
  const t = await getT();
  const f = filters;
  const field = (on: boolean) =>
    `h-9 w-full min-w-0 rounded-lg border-2 bg-surface px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta-500/30 ${
      on ? "border-terracotta-500 font-semibold" : "border-line dark:border-spruce-300/70"
    }`;
  const activeCount = [f.region, f.terrain, f.club, f.difficulty, f.from || f.to, f.overnight, f.free].filter(Boolean).length;
  const filtered = activeCount > 0;
  const check = (name: string, on: boolean, label: string) => (
    <label className={`${field(on)} flex cursor-pointer items-center gap-2`}>
      <input type="checkbox" name={name} value="1" defaultChecked={on} className="h-4 w-4 shrink-0 accent-spruce-500" />
      <span className="truncate">{label}</span>
    </label>
  );
  const date = (name: "from" | "to", value: string, min: string | undefined, label: string) => (
    <DateField name={name} value={value} min={min} label={label} className={`${field(!!value)} max-sm:col-span-2`} />
  );
  // On the right of the box: the view switch above, the count below — in
  // orange like the calendar's day heading, with "clear" once a filter is set.
  const switcher = <ViewSwitch view={view} filters={f} t={t} />;
  const found = (
    <span className="flex items-center gap-3 whitespace-nowrap">
      <span className="text-lg font-bold text-terracotta-500">{t("toursPage.results", { count })}</span>
      {filtered && (
        <Link
          href={clearHref ?? toQuery(action, hidden)}
          title={t("toursPage.clear")}
          className="inline-flex items-center gap-1 text-sm font-semibold text-terracotta-700 hover:underline dark:text-terracotta-300"
        >
          <span aria-hidden="true">✕</span>
          {t("toursPage.clearShort")}
        </Link>
      )}
    </span>
  );

  return (
    <AutoSubmitForm action={action} className="mt-4 rounded-2xl border border-line bg-surface p-3 dark:border-spruce-300/60">
      {Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <FilterPanel active={activeCount} found={found} switcher={switcher} show={t("toursPage.filters")} hide={t("toursPage.hideFilters")}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_12rem]">
        <select name="region" defaultValue={f.region} aria-label={t("toursPage.region")} className={field(!!f.region)}>
          <option value="">{t("toursPage.region")}</option>
          {REGIONS.map((r) => <option key={r} value={r}>{t(`region.${r}`)}</option>)}
        </select>
        <select name="terrain" defaultValue={f.terrain} aria-label={t("toursPage.terrain")} className={field(!!f.terrain)}>
          <option value="">{t("toursPage.terrain")}</option>
          {TERRAINS.map((k) => <option key={k} value={k}>{t(`terrain.${k}`)}</option>)}
        </select>
        <select name="club" defaultValue={f.club} aria-label={t("toursPage.club")} className={field(!!f.club)}>
          <option value="">{t("toursPage.club")}</option>
          {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="difficulty" defaultValue={f.difficulty} aria-label={t("toursPage.difficulty")} className={field(!!f.difficulty)}>
          <option value="">{t("toursPage.difficulty")}</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{t(`difficulty.${d}`)}</option>)}
        </select>
        <div className="flex items-center justify-center max-lg:hidden">{switcher}</div>
        {date("from", f.from, minDate, t("toursPage.from"))}
        {date("to", f.to, f.from || minDate, t("toursPage.to"))}
        {check("overnight", f.overnight, t("calendar.night"))}
        {check("free", f.free, t("calendar.free"))}
        <div className="flex items-center justify-center max-lg:hidden">{found}</div>
      </div>
      </FilterPanel>
      <button type="submit" className="sr-only">{t("calendar.apply")}</button>
    </AutoSubmitForm>
  );
}

// Reads the shared filters from the URL (older calendar links used
// level/night; they still work).
export function readFilters(
  p: Record<string, string | undefined>,
  clubs: { id: string }[]
): TourFilters {
  const pick = (list: readonly string[], v?: string) => (list.includes(v ?? "") ? v! : "");
  const from = isDay(p.from) ? p.from : "";
  const to = isDay(p.to) && (!from || p.to! >= from) ? p.to! : "";
  return {
    region: pick(REGIONS, p.region),
    terrain: pick(TERRAINS, p.terrain),
    club: clubs.some((c) => c.id === p.club) ? p.club! : "",
    difficulty: pick(DIFFICULTIES, p.difficulty ?? p.level),
    from,
    to,
    overnight: ["1", "true"].includes(p.overnight ?? p.night ?? ""),
    free: p.free === "1",
  };
}
