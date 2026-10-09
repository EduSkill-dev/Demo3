import type { Metadata } from "next";
import { Noto_Sans_Armenian, Outfit } from "next/font/google";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getTheme } from "@/i18n/server";
import { getSiteTexts } from "@/lib/siteTexts";
import { getViewer } from "@/lib/viewer";
import FrozenGuard from "@/components/layout/FrozenGuard";
import InputGuard from "@/components/layout/InputGuard";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import "./globals.css";

// Outfit for Latin text and the wordmark, Noto Sans Armenian for Armenian.
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["500", "700"] });
const notoArmenian = Noto_Sans_Armenian({
  subsets: ["armenian"],
  variable: "--font-noto-armenian",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Culmen", template: "%s" },
  description: "Find and book hikes and tours from clubs across Armenia.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Language and theme come from cookies, so the first paint is already right.
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  const [overrides, viewer] = await Promise.all([getSiteTexts(locale), getViewer()]);

  return (
    <html
      lang={locale}
      className={`${outfit.variable} ${notoArmenian.variable}${theme === "dark" ? " dark" : ""}`}
    >
      <body className="flex min-h-screen flex-col bg-stone font-sans text-[18px] leading-normal text-ink">
        <I18nProvider locale={locale} overrides={overrides}>
          <InputGuard />
          <SiteHeader />
          {/* The header stays usable (language, theme, log out); a frozen
              account can only look at everything below it. */}
          <FrozenGuard active={!!viewer?.frozen}>
            <FavoritesProvider userId={viewer?.role === "individual" ? viewer.id : null}>
              <div className="flex-1">{children}</div>
            </FavoritesProvider>
            <SiteFooter />
          </FrozenGuard>
        </I18nProvider>
      </body>
    </html>
  );
}
