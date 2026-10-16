import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPublicTours } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { addDays, addMonths, dateWords, dayInWords, isDay, isMonth, monthOf, todayInYerevan, weekdayIndex } from "@/lib/calendar";
import { ToursFilters, ToursHeader, filterQuery, readFilters } from "@/components/tour/ToursChrome";
import { seatsLeft } from "@/components/calendar/parts";
import TourGrid from "@/components/tour/TourGrid";
import CustomTourCta from "@/components/requests/CustomTourCta";
import ScrollStrip from "@/components/ui/ScrollStrip";

export async function generateMetadata({ searchParams }: { searchParams: Params }): Promise<Metadata> {
  // The plain page is indexed; a filtered or dated view of it is not.
  const filtered = Object.values(searchParams).some(Boolean);
  return { title: `${(await getT())("toursPage.title")}`, ...(filtered ? { robots: { index: false, follow: false } } : {}) };
}

type Params = Record<string, string | undefined>;

// The Tours page: the hikes still to come, as cards in date order. Over them,
// the days of the month that have hikes (only those). Choosing one sets the
// filter's From and To to that day, as the calendar does; "All" clears them.
// The small arrows by the month's name change the month; the arrows at the
// ends of the days only slide them. Finished hikes are in the calendar view.
// Every filter lives in the URL.
export default async function ToursPage({ searchParams }: { searchParams: Params }) {
  const t = await getT();
  const words = dateWords(t);
  const today = todayInYerevan();

  // An old ?day= link: that day becomes the filter's From and To.
  if (isDay(searchParams.day)) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v && k !== "day") q.set(k, v);
    q.set("from", searchParams.day);
    q.set("to", searchParams.day);
    redirect(`/tours?${q}`);
  }
  const thisMonth = monthOf(today);
  const supabase = await createClient();
  const [all, { data: clubRows }] = await Promise.all([getPublicTours(), supabase.from("clubs").select("id, name").order("name")]);
  const clubs = (clubRows ?? []) as { id: string; name: string }[];
  const f = readFilters(searchParams, clubs);
  // The month of the day strip: asked for, else the chosen From's, else this one.
  const month = isMonth(searchParams.month) && searchParams.month >= thisMonth
    ? searchParams.month
    : f.from && monthOf(f.from) >= thisMonth ? monthOf(f.from) : thisMonth;
  const monthStart = month === thisMonth ? today : `${month}-01`;
  const monthEnd = addDays(`${addMonths(month, 1)}-01`, -1);

  const matching = all.filter(
    (x) =>
      (!f.region || x.regions.includes(f.region)) &&
      (!f.terrain || x.terrains.includes(f.terrain)) &&
      (!f.club || x.club_id === f.club) &&
      (!f.difficulty || x.difficulty === f.difficulty) &&
      (!f.overnight || x.overnight) &&
      (!f.free || (seatsLeft(x, today) ?? 0) > 0)
  );
  const hikeDays = [...new Set(matching.filter((x) => x.date >= monthStart && x.date <= monthEnd).map((x) => x.date))].sort();
  // The cards: the From–To asked for (not before today), else the month from today on.
  const dated = !!(f.from || f.to);
  const from = dated ? (f.from && f.from > today ? f.from : today) : monthStart;
  const to = dated ? f.to || "9999-12-31" : monthEnd;
  const shown = matching.filter((x) => x.date >= from && x.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const oneDay = f.from && f.from === f.to ? f.from : "";

  // Links keep every filter and change only what they are given.
  const state: Record<string, string> = {
    ...filterQuery(f),
    month: isMonth(searchParams.month) && searchParams.month !== monthOf(f.from || today) ? month : "",
  };
  const href = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/tours?${s}` : "/tours";
  };
  const small = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-base leading-none text-ink hover:border-spruce-500";
  const monthLabel = `${t("toursPage.monthHikes", { month: words.monthsGen[+month.slice(5, 7) - 1], name: words.months[+month.slice(5, 7) - 1] })}${month.slice(0, 4) !== today.slice(0, 4) ? ` ${month.slice(0, 4)}` : ""}`;
  const monthName = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1); // "Հոկտեմբերի արշավները"
  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  // Another month: the day choice goes, the other filters stay.
  const monthHref = (m: string) => href({ month: m === thisMonth ? "" : m, from: "", to: "" });
  const pill = (on: boolean) =>
    `flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-full border-2 transition ${
      on ? "border-terracotta-500 bg-terracotta-500 text-[#FFFDF8]" : "border-line bg-surface text-ink hover:border-spruce-500"
    }`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <ToursHeader view="list" filters={f} />
      <ToursFilters action="/tours" filters={f} clubs={clubs} count={shown.length} minDate={today} hidden={{ month: dated ? "" : state.month }} />

      {/* The month's days that have hikes. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          {month > thisMonth ? (
            <Link href={monthHref(prevMonth)} scroll={false} rel="nofollow" aria-label={t("calendar.prevMonth")} className={small}>‹</Link>
          ) : (
            <span className={`${small} cursor-not-allowed opacity-40`} aria-hidden="true">‹</span>
          )}
          <p className="min-w-[10.5rem] text-center text-base font-bold text-heading">{monthName}</p>
          {month < addMonths(thisMonth, 12) ? (
            <Link href={monthHref(nextMonth)} scroll={false} rel="nofollow" aria-label={t("calendar.nextMonth")} className={small}>›</Link>
          ) : (
            <span className={`${small} cursor-not-allowed opacity-40`} aria-hidden="true">›</span>
          )}
        </div>
        <ScrollStrip prevLabel={t("toursPage.daysBack")} nextLabel={t("toursPage.daysOn")}>
          <Link href={href({ from: "", to: "" })} scroll={false} rel="nofollow" aria-current={!dated ? "true" : undefined} className={pill(!dated)}>
            <span className="text-[11px] font-bold leading-none">{t("toursPage.allDays")}</span>
          </Link>
          {hikeDays.map((d) => {
            const on = oneDay === d;
            return (
              <Link key={d} href={href(on ? { from: "", to: "" } : { from: d, to: d })} scroll={false} rel="nofollow" aria-label={dayInWords(d, words)} aria-current={on ? "date" : undefined} className={`${pill(on)} ${d === today && !on ? "!border-spruce-500 text-spruce-700 dark:text-spruce-300" : ""}`}>
                <span className="text-[10px] font-semibold uppercase leading-none">{d === today ? t("calendar.today") : words.weekdaysShort[weekdayIndex(d)]}</span>
                <span className="text-[17px] font-bold leading-none">{+d.slice(8, 10)}</span>
              </Link>
            );
          })}
        </ScrollStrip>
      </div>

      {/* The hikes: all of them in date order, or the chosen day's. */}
      <section className="mt-6">
        {oneDay && (
          <h2 className="mb-3 text-[15px] font-bold text-heading">{oneDay === today ? `${t("calendar.today")} · ` : ""}{dayInWords(oneDay, words)}</h2>
        )}
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-8 text-center text-muted">
            {oneDay ? t("calendar.emptyDay") : t("toursPage.noneInRange")}
          </p>
        ) : (
          <TourGrid tours={shown} size="sm" columns="sm:grid-cols-2 lg:grid-cols-3" backHref={href({})} />
        )}
      </section>

      <div className="mt-12">
        <CustomTourCta />
      </div>
    </main>
  );
}
