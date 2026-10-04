"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { formatDate, type DateStyle } from "./dates";
import { makeT, type TFunction } from "./translate";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

// The root layout reads the locale cookie and passes it down once; client
// components then translate with useT() without another round-trip.
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): TFunction {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}

// fmt(value, style) in the visitor's language; see ./dates for the styles.
export function useFormatDate(): (value: string | Date, style?: DateStyle) => string {
  const locale = useLocale();
  return useMemo(() => (value: string | Date, style: DateStyle = "long") => formatDate(value, locale, style), [locale]);
}
