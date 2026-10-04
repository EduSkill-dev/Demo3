"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";

const SHORT: Record<Locale, string> = { hy: "Հայ", ru: "Рус", en: "Eng" };

// Writes the language cookie and re-renders the server components in place.
export default function LanguageSwitcher() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => choose(e.target.value as Locale)}
        className="cursor-pointer appearance-none rounded-lg border border-line bg-surface py-1.5 pl-2.5 pr-7 text-xs font-semibold text-ink disabled:opacity-60"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} title={t(`language.${l}`)}>
            {SHORT[l]}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5.5 7.5L10 12l4.5-4.5" />
      </svg>
    </label>
  );
}
