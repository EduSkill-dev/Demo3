import { INTL_LOCALE, type Locale } from "./config";

// Dates for every screen. Armenian is formatted by hand: many browsers ship
// without Armenian month names and silently fall back to English
// ("October 4, 2026"). Russian and English use the built-in Intl data.

export type DateStyle =
  | "long" // 4 հոկտեմբերի, 2026 թ.
  | "short" // 4 հոկ, 2026
  | "weekday" // շբթ, 4 հոկտեմբերի (tour cards)
  | "weekdayLong" // շաբաթ, 4 հոկտեմբերի, 2026 թ.
  | "dateTime"; // 4 հոկ, 2026, 18:11

const HY_MONTHS = [
  "հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
  "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի",
];
const HY_MONTHS_SHORT = ["հնվ", "փտվ", "մրտ", "ապր", "մյս", "հնս", "հլս", "օգս", "սեպ", "հոկ", "նոյ", "դեկ"];
const HY_WEEKDAYS = ["կիրակի", "երկուշաբթի", "երեքշաբթի", "չորեքշաբթի", "հինգշաբթի", "ուրբաթ", "շաբաթ"];
const HY_WEEKDAYS_SHORT = ["կիր", "երկ", "երք", "չրք", "հնգ", "ուրբ", "շբթ"];

// "2026-10-04" is a calendar day (no time zone shift); anything else is an instant.
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

const INTL_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: "numeric", month: "long", year: "numeric" },
  short: { day: "numeric", month: "short", year: "numeric" },
  weekday: { weekday: "short", day: "numeric", month: "long" },
  weekdayLong: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  dateTime: { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
};

export function formatDate(value: string | Date, locale: Locale, style: DateStyle = "long"): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return String(value);
  if (locale !== "hy") return d.toLocaleString(INTL_LOCALE[locale], INTL_OPTIONS[style]);

  const day = d.getDate();
  const year = d.getFullYear();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  switch (style) {
    case "short":
      return `${day} ${HY_MONTHS_SHORT[d.getMonth()]}, ${year}`;
    case "weekday":
      return `${HY_WEEKDAYS_SHORT[d.getDay()]}, ${day} ${HY_MONTHS[d.getMonth()]}`;
    case "weekdayLong":
      return `${HY_WEEKDAYS[d.getDay()]}, ${day} ${HY_MONTHS[d.getMonth()]}, ${year} թ.`;
    case "dateTime":
      return `${day} ${HY_MONTHS_SHORT[d.getMonth()]}, ${year}, ${time}`;
    default:
      return `${day} ${HY_MONTHS[d.getMonth()]}, ${year} թ.`;
  }
}

export function formatNumber(value: number, locale: Locale): string {
  // Armenian groups thousands with a space; Intl data for hy is often missing.
  if (locale === "hy") return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}
