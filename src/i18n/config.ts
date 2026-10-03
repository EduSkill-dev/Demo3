export const LOCALES = ["hy", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "hy";

// Cookie names shared by the server layout and the client switchers.
export const LOCALE_COOKIE = "lang";
export const THEME_COOKIE = "theme";
export type Theme = "light" | "dark";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

// BCP 47 tags for Intl date/number formatting.
export const INTL_LOCALE: Record<Locale, string> = {
  hy: "hy-AM",
  ru: "ru-RU",
  en: "en-GB",
};
