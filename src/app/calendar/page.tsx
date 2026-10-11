import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPublicTours, type PublicTour } from "@/lib/publicTours";
import { DIFFICULTIES, REGIONS } from "@/lib/catalog";
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
import AutoSubmitForm from "@/components/calendar/AutoSubmitForm";
import CopyLinkButton from "@/components/ui/CopyLinkButton";
import { AgendaCard, MoonIcon, PanelCard, seatsLeft } from "@/components/calendar/parts";
import type { Difficulty } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("calendar.title"), description: t("calendar.subtitle") };
}

type Params = { month?: string; day?: string; region?: string; club?: string; level?: string; night?: string; free?: string; view?: string };

// Every club's published hikes on one calendar. The whole state is in the
// URL (month, day, filters, view), so each view can be shared and the page
// works without client-side JavaScript: days and filters are plain links.
export default async function CalendarPage({ searchParams }: { searchParams: Params }) {
  const t = await getT();
  const words = dateWords(t);
  const today = todayInYerevan();

  const dayParam = isDay(searchParams.day) ? searchParams.day : null;
  const month = isMonth(searchParams.month) ? searchParams.month : dayParam ? monthOf(dayParam) : monthOf(today);
  const grid = monthGrid(month);
  const gridStart = grid.days[0];
  const gridEnd = grid.days[grid.days.length - 1];

  const region = (REGIONS as readonly string[]).includes(searchParams.region ?? "") ? searchParams.region! : "";
  const level = (DIFFICULTIES as readonly string[]).includes(searchParams.level ?? "") ? (searchParams.level as Difficulty) : "";
  const night = searchParams.night === "1";
  const free = searchParams.free === "1";
  const list = searchParams.view === "list";

  const supabase = await createClient();
  const [all, { data: clubRows }] = await Promise.all([
    getPublicTours({ range: { from: gridStart, to: gridEnd } }),
    supabase.from("clubs").select("id, name").order("name"),
  ]);
  const clubs = (clubRows ?? []) as { id: string; name: string }[];
  const club = clubs.some((c) => c.id === searchParams.club) ? searchParams.club! : "";

  const tours = all.filter(
    (x) =>
      (!region || x.regions.includes(region)) &&
      (!club || x.club.id === club) &&
      (!level || x.difficulty === level) &&
      (!night || x.overnight) &&
      (!free || (seatsLeft(x, today) ?? 0) > 0)
  );
  const byDay = new Map<string, PublicTour[]>(grid.days.map((d) => [d, tours.filter((x) => coversDay(x, d))]));
  const count = (d: string) => byDay.get(d)?.length ?? 0;

  // The chosen day: the one in the URL; else today when it has hikes, else
  // the next day that has some (in another month: its first day with hikes).
  const inGrid = (d: string) => d >= gridStart && d <= gridEnd;
  const fallbackFrom = month === monthOf(today) ? today : grid.first;
  const selected =
    dayParam && inGrid(dayParam)
      ? dayParam
      : grid.days.find((d) => d >= fallbackFrom && count(d) > 0) ?? fallbackFrom;
  const dayTours = byDay.get(selected) ?? [];

  // Links keep every filter and change only what they are given.
  const state: Record<string, string> = { month, day: dayParam ?? "", region, club, level, night: night ? "1" : "", free: free ? "1" : "", view: list ? "list" : "" };
  const href = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };
  const dayHref = (d: string) => href({ day: d, month: d >= grid.first && d <= grid.last ? month : monthOf(d) });
  const weekend = comingWeekend(today);
  const weekendOn = selected === weekend || selected === addDays(weekend, 1);
  const filtered = !!(region || club || level || night || free);

  const pill = "flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold transition";
  const pillOff = `${pill} border-line bg-surface text-ink hover:border-spruce-500`;
  const pillOn = `${pill} border-spruce-900 bg-spruce-900 text-[#FFFDF8]`;
  const select = "h-11 max-w-[11rem] cursor-pointer rounded-full border-2 border-line bg-surface pl-4 pr-8 text-sm font-semibold text-ink hover:border-spruce-500 focus:border-terracotta-500 focus:outline-none";
  const round = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-xl leading-none text-ink hover:border-spruce-500";
  const segment = (on: boolean) => `flex h-9 items-center rounded-full px-4 text-sm font-semibold ${on ? "bg-spruce-500 text-[#FFFDF8]" : "text-ink hover:text-terracotta-700"}`;

  const monthBar = (
    <div className="flex items-center gap-3">
      <Link href={href({ month: addMonths(month, -1), day: "" })} aria-label={t("calendar.prevMonth")} className={round}>‹</Link>
      <Link href={href({ month: addMonths(month, 1), day: "" })} aria-label={t("calendar.nextMonth")} className={round}>›</Link>
      <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-heading sm:text-[22px]">{monthTitle(month, words)}</h2>
      <Link href={href({ month: "", day: "" })} className={`${pillOff} max-sm:hidden`}>{t("calendar.today")}</Link>
    </div>
  );

  // Hikes grouped by day, as cards.
  const agenda = (days: string[]) =>
    days.length === 0 ? (
      <p className="rounded-[18px] border border-line bg-surface p-6 text-center text-muted">{t("calendar.emptyList")}</p>
    ) : (
      <div className="space-y-6">
        {days.map((d) => (
          <section key={d}>
            <h3 className="text-[15px] font-bold text-heading">{dayInWords(d, words)}</h3>
            <div className="mt-2 grid gap-3 lg:grid-cols-2">
              {byDay.get(d)!.map((x) => (
                <AgendaCard key={x.id} tour={x} today={today} t={t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  const monthDaysWithTours = grid.days.filter((d) => d >= grid.first && d <= grid.last && count(d) > 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* ---------- Title ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] font-bold leading-tight text-heading lg:text-[34px]">
            <span className="hidden lg:inline">{t("calendar.title")}</span>
            <span className="lg:hidden" aria-hidden="true">{t("calendar.short")}</span>
          </h1>
          <p className="mt-1 text-muted">{t("calendar.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a href="/calendar.ics" className="text-sm font-semibold text-terracotta-700 underline underline-offset-4 hover:text-terracotta-500 dark:text-terracotta-300">
            {t("calendar.subscribe")}
          </a>
          <div className="hidden rounded-full bg-sand p-1 lg:flex">
            <Link href={href({ view: "" })} className={segment(!list)} aria-current={!list ? "true" : undefined}>{t("calendar.viewMonth")}</Link>
            <Link href={href({ view: "list" })} className={segment(list)} aria-current={list ? "true" : undefined}>{t("calendar.viewList")}</Link>
          </div>
        </div>
      </div>

      {/* ---------- Desktop ---------- */}
      <div className="mt-6 hidden lg:block">
        <div className="flex flex-wrap items-center gap-2">
          <AutoSubmitForm action="/calendar" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="month" value={month} />
            {dayParam && <input type="hidden" name="day" value={dayParam} />}
            {list && <input type="hidden" name="view" value="list" />}
            <select name="region" defaultValue={region} aria-label={t("toursPage.region")} className={select}>
              <option value="">{t("toursPage.region")}</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{t(`region.${r}`)}</option>
              ))}
            </select>
            <select name="club" defaultValue={club} aria-label={t("toursPage.club")} className={select}>
              <option value="">{t("toursPage.club")}</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select name="level" defaultValue={level} aria-label={t("toursPage.difficulty")} className={select}>
              <option value="">{t("toursPage.difficulty")}</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{t(`difficulty.${d}`)}</option>
              ))}
            </select>
            <label className={`${night ? pillOn : pillOff} cursor-pointer gap-2`}>
              <input type="checkbox" name="night" value="1" defaultChecked={night} className="h-4 w-4 accent-spruce-500" />
              {t("calendar.night")}
            </label>
            <label className={`${free ? pillOn : pillOff} cursor-pointer gap-2`}>
              <input type="checkbox" name="free" value="1" defaultChecked={free} className="h-4 w-4 accent-spruce-500" />
              {t("calendar.free")}
            </label>
            <button type="submit" className="sr-only">{t("calendar.apply")}</button>
          </AutoSubmitForm>
          <Link href={dayHref(weekend)} className={weekendOn ? pillOn : pillOff}>{t("calendar.weekend")}</Link>
          {filtered && (
            <Link href={href({ region: "", club: "", level: "", night: "", free: "" })} className="px-2 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
              {t("toursPage.clear")}
            </Link>
          )}
        </div>

        {list ? (
          <div className="mt-6 space-y-5">
            {monthBar}
            {agenda(monthDaysWithTours)}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">
            <div>
              {monthBar}
              <div className="mt-4 overflow-hidden rounded-2xl border-2 border-line">
                <div className="grid grid-cols-7 bg-sand">
                  {words.weekdaysShort.map((w) => (
                    <div key={w} className="py-2 text-center text-[13px] font-bold text-muted">{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px border-t border-line bg-line">
                  {grid.days.map((d) => {
                    const items = byDay.get(d)!;
                    const inMonth = d >= grid.first && d <= grid.last;
                    return (
                      <Link
                        key={d}
                        href={dayHref(d)}
                        scroll={false}
                        aria-label={items.length ? t("calendar.cellLabel", { date: dayAndMonth(d, words), count: items.length }) : dayAndMonth(d, words)}
                        aria-current={d === selected ? "date" : undefined}
                        className={`flex min-h-[100px] min-w-0 flex-col gap-1 p-1.5 transition hover:bg-sand ${inMonth ? "bg-surface" : "bg-sand"} ${
                          d === selected ? "shadow-[inset_0_0_0_3px_#C9491F]" : ""
                        }`}
                      >
                        <span
                          className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-[13px] font-semibold ${
                            d === today ? "bg-spruce-500 text-[#FFFDF8]" : inMonth ? "text-ink" : "text-muted"
                          }`}
                        >
                          {+d.slice(8, 10)}
                        </span>
                        {items.slice(0, 2).map((x) => (
                          <span
                            key={x.id}
                            className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-semibold"
                            style={{ background: DIFFICULTY_COLORS[x.difficulty].bg, color: DIFFICULTY_COLORS[x.difficulty].text }}
                          >
                            {x.overnight && <MoonIcon />}
                            <span className="truncate">{x.title}</span>
                          </span>
                        ))}
                        {items.length > 2 && <span className="px-1 text-xs font-semibold text-terracotta-700 dark:text-terracotta-300">+{items.length - 2}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
                {DIFFICULTIES.map((d) => (
                  <span key={d} className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-[4px] border border-black/10" style={{ background: DIFFICULTY_COLORS[d].bg }} />
                    {t(`difficulty.${d}`)}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <MoonIcon className="h-3.5 w-3.5" />
                  {t("calendar.night")}
                </span>
              </div>
            </div>

            <aside className="rounded-3xl bg-sand p-[22px]" aria-live="polite">
              <h2 className="text-xl font-bold text-heading">{dayInWords(selected, words)}</h2>
              <p className="mt-0.5 text-sm text-muted">{t("calendar.tourCount", { count: dayTours.length })}</p>
              <div className="mt-4 space-y-3">
                {dayTours.length === 0 ? (
                  <p className="rounded-[18px] border border-line bg-surface p-5 text-center text-sm text-muted">{t("calendar.emptyDay")}</p>
                ) : (
                  dayTours.map((x) => <PanelCard key={x.id} tour={x} today={today} t={t} />)
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {dayTours.length > 0 ? (
                  <a href={`/calendar.ics?day=${selected}`} className="flex h-11 items-center justify-center rounded-full border-2 border-spruce-900 px-3 text-sm font-semibold text-ink hover:bg-surface dark:border-line">
                    {t("calendar.addToMine")}
                  </a>
                ) : (
                  <span className="flex h-11 items-center justify-center rounded-full border-2 border-line px-3 text-sm font-semibold text-muted opacity-60">{t("calendar.addToMine")}</span>
                )}
                <CopyLinkButton
                  href={href({ day: selected })}
                  label={t("calendar.share")}
                  copiedLabel={t("calendar.copied")}
                  className="flex h-11 items-center justify-center rounded-full border-2 border-spruce-900 px-3 text-sm font-semibold text-ink hover:bg-surface dark:border-line"
                />
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* ---------- Phones and tablets: an agenda ---------- */}
      <div className="mt-5 space-y-4 lg:hidden">
        {monthBar}
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
                className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 ${
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
          <Link href={href({ month: "", day: "" })} className={`${pillOff} !h-10 shrink-0 sm:hidden`}>{t("calendar.today")}</Link>
          <Link href={href({ level: "", night: "" })} scroll={false} className={`${!level && !night ? pillOn : pillOff} !h-10 shrink-0`}>{t("toursPage.any")}</Link>
          {DIFFICULTIES.map((d) => (
            <Link key={d} href={href({ level: level === d ? "" : d })} scroll={false} className={`${level === d ? pillOn : pillOff} !h-10 shrink-0`}>
              {t(`difficulty.${d}`)}
            </Link>
          ))}
          <Link href={href({ night: night ? "" : "1" })} scroll={false} className={`${night ? pillOn : pillOff} !h-10 shrink-0 gap-1.5`}>
            <MoonIcon className="h-3.5 w-3.5" />
            {t("calendar.night")}
          </Link>
          <Link href={dayHref(weekend)} scroll={false} className={`${weekendOn ? pillOn : pillOff} !h-10 shrink-0`}>{t("calendar.weekend")}</Link>
        </div>
        {agenda(grid.days.filter((d) => d >= selected && count(d) > 0))}
      </div>
    </main>
  );
}
