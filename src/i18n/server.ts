import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  THEME_COOKIE,
  isLocale,
  type Locale,
  type Theme,
} from "./config";
import { makeT, type TFunction } from "./translate";
import { formatDate, type DateStyle } from "./dates";

// Server components / route handlers: read the visitor's choices from cookies.
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getTheme(): Promise<Theme> {
  return (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}

export async function getT(): Promise<TFunction> {
  return makeT(await getLocale());
}

export async function getFormatDate(): Promise<(value: string | Date, style?: DateStyle) => string> {
  const locale = await getLocale();
  return (value, style = "long") => formatDate(value, locale, style);
}
