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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("calendar.title"), description: t("calendar.subtitle") };
}

type Params = Record<string, string | undefined>;

// The calendar view of the Tours page: every club's hikes on a month grid,
// and under it the chosen day's hikes as the same cards as the list. The
// whole state is in the URL (month, day, filters), so a view can be shared.
// The list view is the Tours page itself (/tours).
export default async function CalendarPage({ searchParams }: { searchParams: Params }) {
  const t = await getT();
  const words = dateWords(t);
  const today = todayInYerevan();

  if (searchParams.view === "list") redirect("/tours");
  const dayParam = isDay(searchParams.day) ? searchParams.day : null;
  const fromParam = isDay(searchParams.from) ? searchParams.from : null;
  const month = isMonth(searchParams.month) ? searchParams.month : dayParam ? monthOf(dayParam) : fromParam ? monthOf(fromParam) : monthOf(today);
  const grid = monthGrid(month);
  const gridStart = grid.days[0];
  const gridEnd = grid.days[grid.days.length - 1];

  const supabase = await createClient();
  const [all, { data: clubRows }] = await Promise.all([
    getPublicTours({ range: { from: gridStart, to: gridEnd } }),
    supabase.from("clubs").select("id, name").order("name"),
  ]);
  const clubs = (clubRows ?? []) as { id: string; name: string }[];
  const f = readFilters(searchParams, clubs);

  const tours = all.filter(
    (x) =>
      (!f.from || (x.end_date ?? x.date) >= f.from) &&
      (!f.to || x.date <= f.to) &&
      (!f.region || x.regions.includes(f.region)) &&
      (!f.terrain || x.terrains.includes(f.terrain)) &&
      (!f.club || x.club.id === f.club) &&
      (!f.difficulty || x.difficulty === f.difficulty) &&
      (!f.overnight || x.overnight) &&
      (!f.free || (seatsLeft(x, today) ?? 0) > 0),
  );
  const monthCount = tours.filter((x) => x.date <= grid.last && (x.end_date ?? x.date) >= grid.first).length;
  const byDay = new Map<string, PublicTour[]>(grid.days.map((d) => [d, tours.filter((x) => coversDay(x, d))]));
  const count = (d: string) => byDay.get(d)?.length ?? 0;

  // The chosen day: the one in the URL; else today when it has hikes, else
  // the next day that has some (in another month: its first day with hikes).
  const inGrid = (d: string) => d >= gridStart && d <= gridEnd;
  const fallbackFrom = month === monthOf(today) ? today : grid.first;
  const selected = dayParam && inGrid(dayParam) ? dayParam : (grid.days.find((d) => d >= fallbackFrom && count(d) > 0) ?? fallbackFrom);
  const dayTours = byDay.get(selected) ?? [];

  // Links keep every filter and change only what they are given.
  const state: Record<string, string> = {
    ...filterQuery(f),
    month,
    day: dayParam ?? "",
  };
  const href = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };
  const dayHref = (d: string) =>
    href({
      day: d,
      month: d >= grid.first && d <= grid.last ? month : monthOf(d),
    });
  const weekend = comingWeekend(today);
  // The month's hikes as a file: from today (or the month's first day, for a
  // month still to come) to the month's last day, with the region and club filters.
  const fileQuery = new URLSearchParams({
    from: grid.first > today ? grid.first : today,
    to: grid.last,
  });
  if (f.region) fileQuery.set("region", f.region);
  if (f.club) fileQuery.set("club", f.club);
  const monthFile = `/calendar.ics?${fileQuery}`;
  const weekendOn = selected === weekend || selected === addDays(weekend, 1);

  const small = "flex h-8 items-center rounded-full border-2 px-3 text-xs font-semibold transition";
  const smallOff = `${small} border-line bg-surface text-ink hover:border-spruce-500`;
  const smallOn = `${small} border-spruce-900 bg-spruce-900 text-[#FFFDF8]`;
  const arrow = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-lg leading-none text-ink hover:border-spruce-500";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <ToursHeader view="calendar" filters={f} />
      <ToursFilters action="/calendar" filters={f} clubs={clubs} count={monthCount} hidden={{ month }} />

      <div className="mt-5 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* ---------- Desktop: a small month that stays in view ---------- */}
        <aside className="sticky top-24 hidden rounded-2xl border border-line bg-surface p-4 lg:block">
          <div className="flex items-center gap-2">
            <Link href={href({ month: addMonths(month, -1), day: "" })} scroll={false} aria-label={t("calendar.prevMonth")} className={arrow}>
              ‹
            </Link>
            <h2 className="min-w-0 flex-1 truncate text-center text-[15px] font-bold text-heading">{monthTitle(month, words)}</h2>
            <Link href={href({ month: addMonths(month, 1), day: "" })} scroll={false} aria-label={t("calendar.nextMonth")} className={arrow}>
              ›
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted">
            {words.weekdaysShort.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.days.map((d) => {
              const items = byDay.get(d)!;
              const inMonth = d >= grid.first && d <= grid.last;
              const on = d === selected;
              return (
                <Link
                  key={d}
                  href={dayHref(d)}
                  scroll={false}
                  title={items.map((x) => x.title).join("\n") || undefined}
                  aria-label={items.length ? t("calendar.cellLabel", { date: dayAndMonth(d, words), count: items.length }) : dayAndMonth(d, words)}
                  aria-current={on ? "date" : undefined}
                  className={`flex h-11 flex-col items-center justify-center gap-1 rounded-lg border-2 transition ${
                    on
                      ? "border-terracotta-500 bg-terracotta-500/10"
                      : d === today
                        ? "border-spruce-500"
                        : items.length
                          ? "border-transparent bg-sand hover:border-spruce-500"
                          : "border-transparent hover:border-line"
                  } ${inMonth ? "" : "opacity-40"}`}
                >
                  <span className={`text-[13px] leading-none ${items.length ? "font-bold text-ink" : "text-muted"}`}>{+d.slice(8, 10)}</span>
                  <span className="flex h-1.5 gap-0.5">
                    {items.slice(0, 4).map((x) => (
                      <span key={x.id} className="h-1.5 w-1.5 rounded-full ring-1 ring-black/10 dark:ring-white/30" style={{ background: DIFFICULTY_COLORS[x.difficulty].bar }} />
                    ))}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            {DIFFICULTIES.map((d) => (
              <span key={d} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full ring-1 ring-black/10 dark:ring-white/30" style={{ background: DIFFICULTY_COLORS[d].bar }} />
                {t(`difficulty.${d}`)}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <Link href={href({ month: "", day: "" })} scroll={false} className={smallOff}>
              {t("calendar.today")}
            </Link>
            <Link href={dayHref(weekend)} scroll={false} className={weekendOn ? smallOn : smallOff}>
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
            <Link href={href({ month: addMonths(month, -1), day: "" })} scroll={false} aria-label={t("calendar.prevMonth")} className={arrow}>
              ‹
            </Link>
            <Link href={href({ month: addMonths(month, 1), day: "" })} scroll={false} aria-label={t("calendar.nextMonth")} className={arrow}>
              ›
            </Link>
            <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-heading">{monthTitle(month, words)}</h2>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => addDays(mondayOf(selected), i)).map((d, i) => {
              const on = d === selected;
              return (
                <Link
                  key={d}
                  href={dayHref(d)}
                  scroll={false}
                  aria-label={count(d) ? t("calendar.cellLabel", { date: dayAndMonth(d, words), count: count(d) }) : dayAndMonth(d, words)}
                  aria-current={on ? "date" : undefined}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 ${
                    on ? "border-spruce-500 bg-spruce-500 text-[#FFFDF8]" : `border-line bg-surface text-ink ${d === today ? "border-spruce-500" : ""}`
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
            <Link href={href({ month: "", day: "" })} scroll={false} className={`${smallOff} shrink-0`}>
              {t("calendar.today")}
            </Link>
            <Link href={dayHref(weekend)} scroll={false} className={`${weekendOn ? smallOn : smallOff} shrink-0`}>
              {t("calendar.weekend")}
            </Link>
            <a href={monthFile} download className={`${smallOff} shrink-0`}>
              {t("calendar.downloadMonth")}
            </a>
          </div>
        </div>

        {/* ---------- The chosen day's hikes, as cards ---------- */}
        <section className="max-lg:mt-6" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-heading">
              {dayInWords(selected, words)}
              <span className="ml-2 text-sm font-normal text-muted">{t("calendar.tourCount", { count: dayTours.length })}</span>
            </h2>
            <CopyLinkButton
              href={href({ day: selected })}
              label={t("calendar.share")}
              copiedLabel={t("calendar.copied")}
              className="flex h-8 items-center justify-center rounded-full border-2 border-spruce-900 px-3 text-xs font-semibold text-ink hover:bg-sand dark:border-line"
            />
          </div>
          {dayTours.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface p-8 text-center text-muted">{t("calendar.emptyDay")}</p>
          ) : (
            <TourGrid tours={dayTours} size="sm" columns="sm:grid-cols-2" backHref={href({ day: selected })} />
          )}
        </section>
      </div>
    </main>
  );
}
