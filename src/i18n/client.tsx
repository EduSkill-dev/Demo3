"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { formatDate, type DateStyle } from "./dates";
import { makeT, type Overrides, type TFunction } from "./translate";

const LocaleContext = createContext<{ locale: Locale; overrides?: Overrides }>({ locale: DEFAULT_LOCALE });

// The root layout reads the locale cookie (and the admin-edited texts for
// that language) and passes them down once; client components then translate
// with useT() without another round-trip.
export function I18nProvider({
  locale,
  overrides,
  children,
}: {
  locale: Locale;
  overrides?: Overrides;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, overrides }), [locale, overrides]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useT(): TFunction {
  const { locale, overrides } = useContext(LocaleContext);
  return useMemo(() => makeT(locale, overrides), [locale, overrides]);
}

// fmt(value, style) in the visitor's language; see ./dates for the styles.
export function useFormatDate(): (value: string | Date, style?: DateStyle) => string {
  const locale = useLocale();
  return useMemo(() => (value: string | Date, style: DateStyle = "long") => formatDate(value, locale, style), [locale]);
}
