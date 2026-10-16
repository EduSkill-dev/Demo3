import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicTours, type PublicTour } from "@/lib/publicTours";
import { DIFFICULTIES } from "@/lib/catalog";
import { getT } from "@/i18n/server";
import {
  DIFFICULTY_COLORS,
  addDays,
  addMonths,
  comingWeekend,
  coversDay,
  dateWords,
  dayAndMonth,
  dayInWords,
  isDay,
  isMonth,
  lastDayOf,
  mondayOf,
  monthGrid,
  monthOf,
  monthTitle,
  todayInYerevan,
} from "@/lib/calendar";
import { ToursFilters, ToursHeader, filterQuery, readFilters } from "@/components/tour/ToursChrome";
import CopyLinkButton from "@/components/ui/CopyLinkButton";
import { seatsLeft } from "@/components/calendar/parts";
import TourGrid from "@/components/tour/TourGrid";
import MonthDays, { type MonthCell } from "@/components/calendar/MonthDays";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  // The same hikes as the Tours page: not indexed, and its links not followed.
  return { title: t("calendar.title"), description: t("calendar.subtitle"), robots: { index: false, follow: false } };
}

type Params = Record<string, string | undefined>;

// The calendar view of the Tours page: every club's hikes on a month grid,
// and beside it the hikes of the chosen days as the same cards as the list.
// The chosen days ARE the filter's From–To: a click on a day sets both to
// it, a slide over days sets a stretch, and the fields show the same. With
// no days chosen (after "Clear") every hike still to come is listed. The
// whole state is in the URL, so a view can be shared. The list view is the
// Tours page itself (/tours).
export default async function CalendarPage({ searchParams }: { searchParams: Params }) {
  const t = await getT();
  const words = dateWords(t);
  const today = todayInYerevan();

  if (searchParams.view === "list") redirect("/tours");
  // Opening the calendar shows today, written into the filter too; an old
  // ?day= link becomes that day's From–To.
  if (!Object.values(searchParams).some(Boolean)) redirect(`/calendar?from=${today}&to=${today}`);
  if (isDay(searchParams.day)) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v && k !== "day") q.set(k, v);
    q.set("from", searchParams.day);
    q.set("to", searchParams.day);
    redirect(`/calendar?${q}`);
  }

  const supabase = await createClient();
  const { data: clubRows } = await supabase.from("clubs").select("id, name").order("name");
  const clubs = (clubRows ?? []) as { id: string; name: string }[];
  const f = readFilters(searchParams, clubs);
  const chosen = !!(f.from || f.to);
  const lo = f.from || today; // only "To" set: from today on
  const hi = f.to; // "" = no end

  const month = isMonth(searchParams.month) ? searchParams.month : monthOf(f.from || f.to || today);
  const grid = monthGrid(month);
  const gridStart = grid.days[0];
  const gridEnd = grid.days[grid.days.length - 1];

  // One load covers the month on the grid and the chosen stretch.
  const loadFrom = [gridStart, chosen ? lo : today].sort()[0];
  const all = await getPublicTours({ range: { from: loadFrom, to: hi ? [gridEnd, hi].sort()[1] : undefined } });
  const matching = all.filter(
    (x) =>
      (!f.region || x.regions.includes(f.region)) &&
      (!f.terrain || x.terrains.includes(f.terrain)) &&
      (!f.club || x.club.id === f.club) &&
      (!f.difficulty || x.difficulty === f.difficulty) &&
      (!f.overnight || x.overnight) &&
      (!f.free || (seatsLeft(x, today) ?? 0) > 0),
  );
  const byDay = new Map<string, PublicTour[]>(grid.days.map((d) => [d, matching.filter((x) => coversDay(x, d))]));
  const count = (d: string) => byDay.get(d)?.length ?? 0;
  // The cards (and "Found"): the chosen days' hikes, or all still to come.
  const shown = matching
    .filter((x) => lastDayOf(x) >= (chosen ? lo : today) && (!hi || x.date <= hi))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Links keep every filter and change only what they are given.
  const state: Record<string, string> = {
    ...filterQuery(f),
    month: isMonth(searchParams.month) ? searchParams.month : "",
  };
  const href = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };
  // A day's link: From and To become that day (the month follows it).
  const dayHref = (d: string) => href({ from: d, to: d, month: "" });
  const weekend = comingWeekend(today);
  // A year back to a year ahead (the middleware refuses dates beyond that).
  const canPrev = month > addMonths(monthOf(today), -12);
  const canNext = month < addMonths(monthOf(today), 12);
  // The month's hikes as a file: from today (or the month's first day, for a
  // month still to come) to the month's last day, with the region and club filters.
  const fileQuery = new URLSearchParams({
    from: grid.first > today ? grid.first : today,
    to: grid.last,
  });
  if (f.region) fileQuery.set("region", f.region);
  if (f.club) fileQuery.set("club", f.club);
  const monthFile = `/calendar.ics?${fileQuery}`;
  const weekendOn = f.from === weekend && f.to === addDays(weekend, 1);
  const todayOn = f.from === today && f.to === today;
  const heading = !chosen
    ? t("calendar.allUpcoming")
    : f.from && f.to
      ? f.from === f.to
        ? dayInWords(f.from, words)
        : monthOf(f.from) === monthOf(f.to)
          ? `${+f.from.slice(8, 10)}–${dayAndMonth(f.to, words)}`
          : `${dayAndMonth(f.from, words)} – ${dayAndMonth(f.to, words)}`
      : f.from
        ? t("calendar.rangeFrom", { date: dayAndMonth(f.from, words) })
        : t("calendar.rangeTo", { date: dayAndMonth(f.to, words) });
  const cells: MonthCell[] = grid.days.map((d) => {
    const items = byDay.get(d)!;
    return {
      d,
      inMonth: d >= grid.first && d <= grid.last,
      count: items.length,
      dots: items.slice(0, 4).map((x) => DIFFICULTY_COLORS[x.difficulty].bar),
      title: items.map((x) => x.title).join("\n") || undefined,
      label: items.length ? t("calendar.cellLabel", { date: dayAndMonth(d, words), count: items.length }) : dayAndMonth(d, words),
    };
  });
  // The phone's week strip: the week of the first chosen day.
  const weekOf = mondayOf(chosen ? lo : today);

  const small = "flex h-8 items-center rounded-full border-2 px-3 text-xs font-semibold transition";
  const smallOff = `${small} border-line bg-surface text-ink hover:border-spruce-500`;
  const smallOn = `${small} border-spruce-900 bg-spruce-900 text-[#FFFDF8]`;
  const arrow = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-lg leading-none text-ink hover:border-spruce-500";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <ToursHeader view="calendar" filters={f} />
      {/* On wide screens the filters and the month stay in place; only the cards scroll. */}
      <div className="mt-4 lg:sticky lg:top-[72px] lg:z-20 lg:-mx-2 lg:bg-stone lg:px-2 lg:pb-1 lg:pt-3 [&>form]:mt-0">
        <ToursFilters action="/calendar" filters={f} clubs={clubs} count={shown.length} hidden={{ all: chosen ? "" : "1" }} clearHref="/calendar?all=1" />
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* ---------- Desktop: a small month that stays in view ---------- */}
        <aside className="sticky top-[210px] hidden rounded-2xl border border-line bg-surface p-4 lg:block">
          <div className="flex items-center gap-2">
            {canPrev ? (
              <Link href={href({ month: addMonths(month, -1) })} scroll={false} rel="nofollow" aria-label={t("calendar.prevMonth")} className={arrow}>
                ‹
              </Link>
            ) : (
              <span className={`${arrow} opacity-40`} aria-hidden="true">‹</span>
            )}
            <h2 className="min-w-0 flex-1 truncate text-center text-[15px] font-bold text-heading">{monthTitle(month, words)}</h2>
            {canNext ? (
              <Link href={href({ month: addMonths(month, 1) })} scroll={false} rel="nofollow" aria-label={t("calendar.nextMonth")} className={arrow}>
                ›
              </Link>
            ) : (
              <span className={`${arrow} opacity-40`} aria-hidden="true">›</span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted">
            {words.weekdaysShort.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <MonthDays cells={cells} from={f.from} to={f.to} today={today} hrefFor={Object.fromEntries(grid.days.map((d) => [d, dayHref(d)]))} />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            {DIFFICULTIES.map((d) => (
              <span key={d} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full ring-1 ring-black/10 dark:ring-white/30" style={{ background: DIFFICULTY_COLORS[d].bar }} />
                {t(`difficulty.${d}`)}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <Link href={dayHref(today)} scroll={false} rel="nofollow" className={todayOn ? smallOn : smallOff}>
              {t("calendar.today")}
            </Link>
            <Link href={href({ from: weekend, to: addDays(weekend, 1), month: "" })} scroll={false} rel="nofollow" className={weekendOn ? smallOn : smallOff}>
              {t("calendar.weekend")}
            </Link>
            <a href={monthFile} download className="text-xs font-semibold text-terracotta-700 underline underline-offset-4 hover:text-terracotta-500 dark:text-terracotta-300">
              {t("calendar.downloadMonth")}
            </a>
          </div>
        </aside>

        {/* ---------- Phones and tablets: a week strip ---------- */}
        <div className="space-y-4 lg:hidden">
          <div className="flex items-center gap-3">
            {canPrev ? (
              <Link href={href({ month: addMonths(month, -1) })} scroll={false} rel="nofollow" aria-label={t("calendar.prevMonth")} className={arrow}>
                ‹
              </Link>
            ) : (
              <span className={`${arrow} opacity-40`} aria-hidden="true">‹</span>
            )}
            {canNext ? (
              <Link href={href({ month: addMonths(month, 1) })} scroll={false} rel="nofollow" aria-label={t("calendar.nextMonth")} className={arrow}>
                ›
              </Link>
            ) : (
              <span className={`${arrow} opacity-40`} aria-hidden="true">›</span>
            )}
            <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-heading">{monthTitle(month, words)}</h2>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => addDays(weekOf, i)).map((d, i) => {
              const on = chosen && (d === lo || d === (hi || lo));
              const between = chosen && !!hi && d > lo && d < hi;
              return (
                <Link
                  key={d}
                  href={dayHref(d)}
                  scroll={false} rel="nofollow"
                  aria-label={count(d) ? t("calendar.cellLabel", { date: dayAndMonth(d, words), count: count(d) }) : dayAndMonth(d, words)}
                  aria-current={on ? "date" : undefined}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 ${
                    on
                      ? "border-terracotta-500 bg-terracotta-500 text-[#FFFDF8]"
                      : between
                        ? "border-terracotta-500/40 bg-terracotta-500/10 text-ink"
                        : `border-line bg-surface text-ink ${d === today ? "border-spruce-500" : ""}`
                  }`}
                >
                  <span className={`text-[11px] font-semibold ${on ? "" : "text-muted"}`}>{words.weekdaysShort[i]}</span>
                  <span className="text-base font-bold leading-none">{+d.slice(8, 10)}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${count(d) ? (on ? "bg-apricot-500" : "bg-terracotta-500") : "bg-transparent"}`} />
                </Link>
              );
            })}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <Link href={dayHref(today)} scroll={false} rel="nofollow" className={`${todayOn ? smallOn : smallOff} shrink-0`}>
              {t("calendar.today")}
            </Link>
            <Link href={href({ from: weekend, to: addDays(weekend, 1), month: "" })} scroll={false} rel="nofollow" className={`${weekendOn ? smallOn : smallOff} shrink-0`}>
              {t("calendar.weekend")}
            </Link>
            <a href={monthFile} download className={`${smallOff} shrink-0`}>
              {t("calendar.downloadMonth")}
            </a>
          </div>
        </div>

        {/* ---------- The chosen days' hikes (or all to come), as cards ---------- */}
        <section className="max-lg:mt-6" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex flex-wrap items-center gap-x-3 text-lg font-bold text-heading">
              <span>{heading}</span>
              <span className="h-5 w-0.5 rounded-full bg-line" aria-hidden="true" />
              <span className="text-terracotta-500">{t("calendar.tourCount", { count: shown.length })}</span>
            </h2>
            <CopyLinkButton
              href={href({})}
              label={t("calendar.share")}
              copiedLabel={t("calendar.copied")}
              className="flex h-8 items-center justify-center rounded-full border-2 border-spruce-900 px-3 text-xs font-semibold text-ink hover:bg-sand dark:border-line"
            />
          </div>
          {shown.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface p-8 text-center text-muted">
              {f.from && f.from === f.to ? t("calendar.emptyDay") : t("toursPage.noneInRange")}
            </p>
          ) : (
            // Eight at first, then four more at a time.
            <TourGrid key={href({})} tours={shown} size="sm" columns="sm:grid-cols-2" backHref={href({})} first={8} step={4} />
          )}
        </section>
      </div>
    </main>
  );
}
