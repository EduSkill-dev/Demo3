// Date arithmetic for the shared calendar. Everything is a plain "YYYY-MM-DD"
// string (hikes have dates, not times) and "today" is the day in Yerevan.
// Weeks start on Monday. No library: UTC dates are used only to count days.
import type { Difficulty } from "@/types/database";
import type { TFunction } from "@/i18n/translate";

export const TIME_ZONE = "Asia/Yerevan";
const DAY_MS = 86400000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

export function todayInYerevan(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso: string, n: number) => fromUtc(toUtc(iso) + n * DAY_MS);
// 0 = Monday … 6 = Sunday
export const weekdayIndex = (iso: string) => (new Date(toUtc(iso)).getUTCDay() + 6) % 7;
export const mondayOf = (iso: string) => addDays(iso, -weekdayIndex(iso));
export const monthOf = (iso: string) => iso.slice(0, 7);

export function isDay(value: unknown): value is string {
  return typeof value === "string" && ISO_DAY.test(value) && fromUtc(toUtc(value)) === value;
}
export function isMonth(value: unknown): value is string {
  return typeof value === "string" && ISO_MONTH.test(value) && +value.slice(5, 7) >= 1 && +value.slice(5, 7) <= 12 && +value.slice(0, 4) >= 2020 && +value.slice(0, 4) <= 2100;
}

export function addMonths(month: string, n: number): string {
  const index = +month.slice(0, 4) * 12 + (+month.slice(5, 7) - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// The days a month grid shows: whole weeks, 5 or 6 rows (4 for a February
// that starts on a Monday).
export function monthGrid(month: string): { first: string; last: string; days: string[] } {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const offset = weekdayIndex(first);
  const rows = Math.ceil((offset + +last.slice(8, 10)) / 7);
  const start = addDays(first, -offset);
  return { first, last, days: Array.from({ length: rows * 7 }, (_, i) => addDays(start, i)) };
}

// The coming Saturday (today, if it is the weekend already).
export function comingWeekend(today: string): string {
  const w = weekdayIndex(today);
  return w === 6 ? today : addDays(today, 5 - w);
}

// The days a hike covers.
export const lastDayOf = (tour: { date: string; end_date?: string | null }) =>
  tour.end_date && tour.end_date > tour.date ? tour.end_date : tour.date;
export const coversDay = (tour: { date: string; end_date?: string | null }, day: string) =>
  tour.date <= day && day <= lastDayOf(tour);

// Difficulty colours — the same in the grid, the cards and the legend.
export const DIFFICULTY_COLORS: Record<Difficulty, { bg: string; text: string; bar: string }> = {
  easy: { bg: "#DCEBE6", text: "#14443B", bar: "#1E5B4F" },
  medium: { bg: "#FCEBC4", text: "#6B4800", bar: "#F2B134" },
  hard: { bg: "#F9DFD2", text: "#8F2F10", bar: "#C9491F" },
  prof: { bg: "#12332D", text: "#FFFDF8", bar: "#12332D" },
};

// Date words come from the dictionary as comma-separated lists
// (calendar.weekdaysShort, weekdaysFull, months, monthsGen).
export type DateWords = { weekdaysShort: string[]; weekdaysFull: string[]; months: string[]; monthsGen: string[]; dayLong: string; dayShort: string };
export function dateWords(t: TFunction): DateWords {
  const list = (text: string) => text.split(",").map((s) => s.trim());
  return {
    weekdaysShort: list(t("calendar.weekdaysShort")),
    weekdaysFull: list(t("calendar.weekdaysFull")),
    months: list(t("calendar.months")),
    monthsGen: list(t("calendar.monthsGen")),
    dayLong: t("calendar.dayLong"),
    dayShort: t("calendar.dayShort"),
  };
}
const fill = (pattern: string, iso: string, w: DateWords) =>
  pattern
    .replace("{weekday}", w.weekdaysFull[weekdayIndex(iso)])
    .replace("{day}", String(+iso.slice(8, 10)))
    .replace("{month}", w.monthsGen[+iso.slice(5, 7) - 1]);
// "Շաբաթ, 17 հոկտեմբերի"
export const dayInWords = (iso: string, w: DateWords) => fill(w.dayLong, iso, w);
// "17 հոկտեմբերի"
export const dayAndMonth = (iso: string, w: DateWords) => fill(w.dayShort, iso, w);
// "Հոկտեմբեր 2026"
export const monthTitle = (month: string, w: DateWords) => `${w.months[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`;
