import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPublicTours, type PublicTour } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import { addDays, addMonths, dateWords, dayInWords, isDay, isMonth, monthOf, monthTitle, todayInYerevan, weekdayIndex } from "@/lib/calendar";
import { ToursFilters, ToursHeader, filterQuery, readFilters } from "@/components/tour/ToursChrome";
import { seatsLeft } from "@/components/calendar/parts";
import TourGrid from "@/components/tour/TourGrid";
import CustomTourCta from "@/components/requests/CustomTourCta";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getT())("toursPage.title")}` };
}

type Params = Record<string, string | undefined>;

// The Tours page: the hikes still to come, as cards. Over them, the days of
// the month that have hikes (only those) — choosing one shows that day's
// hikes; arrows move to the next or previous month. Finished hikes are in
// the calendar view. Every filter lives in the URL.
export default async function ToursPage({ searchParams }: { searchParams: Params }) {
  const t = await getT();
  const words = dateWords(t);
  const today = todayInYerevan();

  const thisMonth = monthOf(today);
  const month = isMonth(searchParams.month) && searchParams.month >= thisMonth ? searchParams.month : thisMonth;
  const day = isDay(searchParams.day) ? searchParams.day : "";

  const supabase = await createClient();
  const [all, { data: clubRows }] = await Promise.all([getPublicTours(), supabase.from("clubs").select("id, name").order("name")]);
  const clubs = (clubRows ?? []) as { id: string; name: string }[];
  const f = readFilters(searchParams, clubs);
  // The stretch shown: the dates asked for (not before today), else the
  // chosen month from today on.
  const fromSet = !!f.from && f.from >= today;
  const toSet = !!f.to;
  const from = fromSet ? f.from : month === thisMonth ? today : `${month}-01`;
  const to = toSet && f.to >= from ? f.to : fromSet ? addDays(from, 30) : addDays(`${addMonths(month, 1)}-01`, -1);

  const inRange = all.filter(
    (x) =>
      x.date >= from &&
      x.date <= to &&
      (!f.region || x.regions.includes(f.region)) &&
      (!f.terrain || x.terrains.includes(f.terrain)) &&
      (!f.club || x.club_id === f.club) &&
      (!f.difficulty || x.difficulty === f.difficulty) &&
      (!f.overnight || x.overnight) &&
      (!f.free || (seatsLeft(x, today) ?? 0) > 0)
  );
  const hikeDays = [...new Set(inRange.map((x) => x.date))].sort();
  const shown = day ? inRange.filter((x) => x.date === day) : inRange;
  const byDay = new Map<string, PublicTour[]>();
  for (const x of shown) byDay.set(x.date, [...(byDay.get(x.date) ?? []), x]);
  const days = [...byDay.keys()].sort();

  // Links keep every filter and change only what they are given.
  const state: Record<string, string> = {
    ...filterQuery(f),
    month: month === thisMonth || fromSet ? "" : month,
    day,
  };
  const href = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/tours?${s}` : "/tours";
  };
  const round = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-lg leading-none text-ink hover:border-spruce-500";
  const pill = (on: boolean) =>
    `flex h-[60px] min-w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border-2 px-2 transition ${
      on ? "border-spruce-500 bg-spruce-500 text-[#FFFDF8]" : "border-line bg-surface text-ink hover:border-spruce-500"
    }`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
<ToursHeader view="list" filters={f} />
      <ToursFilters action="/tours" filters={f} clubs={clubs} count={shown.length} minDate={today} hidden={{ month: state.month }} />

            {/* The month's days that have hikes. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="w-full text-base font-bold text-heading sm:w-auto sm:min-w-[9rem]">
          {fromSet ? `${dayInWords(from, words)} – ${dayInWords(to, words)}` : monthTitle(month, words)}
        </p>
        {!fromSet &&
          (month > thisMonth ? (
            <Link href={href({ month: addMonths(month, -1) === thisMonth ? "" : addMonths(month, -1), day: "" })} scroll={false} aria-label={t("calendar.prevMonth")} className={round}>‹</Link>
          ) : (
            <span className={`${round} cursor-not-allowed opacity-40`} aria-hidden="true">‹</span>
          ))}
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
          <Link href={href({ day: "" })} scroll={false} className={`${pill(!day)} px-4`}>
            <span className="text-xs font-bold">{t("toursPage.allDays")}</span>
          </Link>
          {hikeDays.map((d) => (
            <Link key={d} href={href({ day: d === day ? "" : d })} scroll={false} aria-label={dayInWords(d, words)} aria-current={d === day ? "date" : undefined} className={`${pill(d === day)} ${d === today && d !== day ? "!border-spruce-500 text-spruce-700 dark:text-spruce-300" : ""}`}>
              <span className="text-[10px] font-semibold uppercase">{d === today ? t("calendar.today") : words.weekdaysShort[weekdayIndex(d)]}</span>
              <span className="text-base font-bold leading-none">{+d.slice(8, 10)}</span>
            </Link>
          ))}
        </div>
        {!fromSet && (
          <Link href={href({ month: addMonths(month, 1), day: "" })} scroll={false} aria-label={t("calendar.nextMonth")} className={round}>›</Link>
        )}
      </div>

      {/* The hikes, by day. */}
      <div className="mt-6 space-y-8">
        {days.length === 0 && (
          <p className="rounded-2xl border border-line bg-surface p-8 text-center text-muted">
            {day ? t("calendar.emptyDay") : t("toursPage.noneInRange")}
          </p>
        )}
        {days.map((d) => (
          <section key={d}>
            <h2 className="mb-3 text-[15px] font-bold text-heading">{d === today ? `${t("calendar.today")} · ` : ""}{dayInWords(d, words)}</h2>
            <TourGrid tours={byDay.get(d)!} size="sm" columns="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" backHref={href({})} />
          </section>
        ))}
      </div>

      <div className="mt-12">
        <CustomTourCta />
      </div>
    </main>
  );
}
