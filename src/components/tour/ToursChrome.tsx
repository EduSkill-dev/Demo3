import Link from "next/link";
import { DIFFICULTIES, REGIONS, TERRAINS } from "@/lib/catalog";
import { getT } from "@/i18n/server";
import { getViewer } from "@/lib/viewer";
import { isDay } from "@/lib/calendar";
import AutoSubmitForm from "@/components/calendar/AutoSubmitForm";

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
export async function ToursHeader({ view, filters }: { view: "list" | "calendar"; filters: TourFilters }) {
  const t = await getT();
  const viewer = await getViewer();
  const segment = (on: boolean) =>
    `flex h-9 items-center rounded-full px-4 text-sm font-semibold ${on ? "bg-spruce-500 text-[#FFFDF8]" : "text-ink hover:text-terracotta-700"}`;
  const q = filterQuery(filters);
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-heading">{t("toursPage.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t("calendar.subtitle")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {viewer?.role === "club" && (
          <Link href="/dashboard/listings/new" className="rounded-full bg-spruce-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900">
            {t("announcements.new")}
          </Link>
        )}
        <div className="flex rounded-full bg-sand p-1">
          {view === "list" ? (
            <span className={segment(true)} aria-current="page">{t("calendar.switchList")}</span>
          ) : (
            <Link href={toQuery("/tours", q)} rel="nofollow" className={segment(false)}>{t("calendar.switchList")}</Link>
          )}
          {view === "calendar" ? (
            <span className={segment(true)} aria-current="page">{t("calendar.switchCalendar")}</span>
          ) : (
            <Link href={toQuery("/calendar", q)} rel="nofollow" className={segment(false)}>{t("calendar.switchCalendar")}</Link>
          )}
        </div>
      </div>
    </div>
  );
}

// The filter box: two compact rows, the field's name standing in for "any",
// a set filter outlined in orange; on the right how many hikes were found
// and a clear button that stands out.
export async function ToursFilters({
  action,
  filters,
  clubs,
  count,
  minDate,
  hidden = {},
}: {
  action: "/tours" | "/calendar";
  filters: TourFilters;
  clubs: { id: string; name: string }[];
  count: number;
  minDate?: string;
  hidden?: Record<string, string>; // state the form keeps (the month, the day)
}) {
  const t = await getT();
  const f = filters;
  const field = (on: boolean) =>
    `h-9 w-full min-w-0 rounded-lg border-2 bg-surface px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta-500/30 ${
      on ? "border-terracotta-500 font-semibold" : "border-line"
    }`;
  const filtered = !!(f.region || f.terrain || f.club || f.difficulty || f.from || f.to || f.overnight || f.free);
  const check = (name: string, on: boolean, label: string) => (
    <label className={`${field(on)} flex cursor-pointer items-center gap-2`}>
      <input type="checkbox" name={name} value="1" defaultChecked={on} className="h-4 w-4 shrink-0 accent-spruce-500" />
      <span className="truncate">{label}</span>
    </label>
  );
  const date = (name: "from" | "to", value: string, min: string | undefined, label: string) => (
    <label className={`${field(!!value)} flex items-center gap-2 max-sm:col-span-2`}>
      <span className="shrink-0 text-xs font-semibold text-muted">{label}</span>
      <input type="date" name={name} min={min} defaultValue={value} aria-label={label} className="h-full min-w-0 flex-1 bg-transparent text-sm focus:outline-none" />
    </label>
  );

  return (
    <AutoSubmitForm action={action} className="mt-4 rounded-2xl border border-line bg-surface p-3">
      {Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
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
        <span className={`flex min-h-[2.25rem] items-center justify-center text-[15px] font-semibold text-muted max-lg:order-last ${filtered ? "" : "lg:row-span-2"}`}>
          {t("toursPage.results", { count })}
        </span>
        {date("from", f.from, minDate, t("toursPage.from"))}
        {date("to", f.to, f.from || minDate, t("toursPage.to"))}
        {check("overnight", f.overnight, t("calendar.night"))}
        {check("free", f.free, t("calendar.free"))}
        {filtered ? (
          <Link
            href={toQuery(action, hidden)}
            className="flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-terracotta-500 bg-terracotta-500/10 px-3 text-sm font-bold text-terracotta-700 hover:bg-terracotta-500 hover:text-white max-lg:order-last dark:text-terracotta-300"
          >
            <span aria-hidden="true">✕</span>
            {t("toursPage.clear")}
          </Link>
        ) : null}
      </div>
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
