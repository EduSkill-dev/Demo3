import { INTL_LOCALE, type Locale } from "./config";

// Dates for every screen. Armenian is formatted by hand: many browsers ship
// without Armenian month names and silently fall back to English
// ("October 4, 2026"). Russian and English use the built-in Intl data.

export type DateStyle =
  | "long" // 4 հոկտեմբերի, 2026 թ.
  | "short" // 4 հոկտ․, 2026
  | "weekday" // շբթ, 4 հոկտեմբերի
  | "weekdayShort" // շբթ, 4 հոկտ․ (tour cards)
  | "weekdayLong" // շաբաթ, 4 հոկտեմբերի, 2026 թ.
  | "dateTime"; // 4 հոկտ․, 2026, 18:11

const HY_MONTHS = [
  "հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
  "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի",
];
// Short months as Armenian writes them: the long ones cut with the
// abbreviation dot (U+2024), the short ones kept whole.
const HY_MONTHS_SHORT = ["հունվ․", "փետր․", "մարտի", "ապր․", "մայիսի", "հունիսի", "հուլիսի", "օգոստ․", "սեպտ․", "հոկտ․", "նոյ․", "դեկտ․"];
const HY_WEEKDAYS = ["կիրակի", "երկուշաբթի", "երեքշաբթի", "չորեքշաբթի", "հինգշաբթի", "ուրբաթ", "շաբաթ"];
const HY_WEEKDAYS_SHORT = ["կիր", "երկ", "երք", "չրք", "հնգ", "ուրբ", "շբթ"];

// The platform lives on Yerevan time. A moment ("…T18:11:00Z") is always
// shown as the clock in Yerevan read it — the same on the server (UTC) and
// in any visitor's browser, so the two never disagree. "2026-10-04" is a
// calendar day and has no time zone at all.
const TIME_ZONE = "Asia/Yerevan";
const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

type Parts = { year: number; month: number; day: number; weekday: number; hour: number; minute: number };

const YEREVAN = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE, hourCycle: "h23", weekday: "short", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
});
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function partsOf(value: string | Date): Parts | null {
  const m = typeof value === "string" ? value.match(DAY_ONLY) : null;
  if (m) {
    const [year, month, day] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
    return { year, month, day, weekday: new Date(Date.UTC(year, month, day)).getUTCDay(), hour: 0, minute: 0 };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const get = Object.fromEntries(YEREVAN.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: +get.year, month: +get.month - 1, day: +get.day, weekday: WEEKDAY_INDEX[get.weekday] ?? 0, hour: +get.hour, minute: +get.minute };
}

const INTL_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: "numeric", month: "long", year: "numeric" },
  short: { day: "numeric", month: "short", year: "numeric" },
  weekday: { weekday: "short", day: "numeric", month: "long" },
  weekdayShort: { weekday: "short", day: "numeric", month: "short" },
  weekdayLong: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  dateTime: { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
};

export function formatDate(value: string | Date, locale: Locale, style: DateStyle = "long"): string {
  const p = partsOf(value);
  if (!p) return String(value);
  if (locale !== "hy") {
    // The Yerevan wall clock, rebuilt as a UTC moment and printed in UTC.
    const wall = new Date(Date.UTC(p.year, p.month, p.day, p.hour, p.minute));
    return wall.toLocaleString(INTL_LOCALE[locale], { ...INTL_OPTIONS[style], timeZone: "UTC" });
  }

  const time = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  switch (style) {
    case "short":
      return `${p.day} ${HY_MONTHS_SHORT[p.month]}, ${p.year}`;
    case "weekday":
      return `${HY_WEEKDAYS_SHORT[p.weekday]}, ${p.day} ${HY_MONTHS[p.month]}`;
    case "weekdayShort":
      return `${HY_WEEKDAYS_SHORT[p.weekday]}, ${p.day} ${HY_MONTHS_SHORT[p.month]}`;
    case "weekdayLong":
      return `${HY_WEEKDAYS[p.weekday]}, ${p.day} ${HY_MONTHS[p.month]}, ${p.year} թ.`;
    case "dateTime":
      return `${p.day} ${HY_MONTHS_SHORT[p.month]}, ${p.year}, ${time}`;
    default:
      return `${p.day} ${HY_MONTHS[p.month]}, ${p.year} թ.`;
  }
}

export function formatNumber(value: number, locale: Locale): string {
  // Armenian groups thousands with a space; Intl data for hy is often missing.
  if (locale === "hy") return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}
