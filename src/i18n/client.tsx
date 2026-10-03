"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "./config";
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

export function useIntlLocale(): string {
  return INTL_LOCALE[useLocale()];
}
