import type { Metadata } from "next";
import localFont from "next/font/local";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getTheme } from "@/i18n/server";
import { getSiteTexts } from "@/lib/siteTexts";
import { getViewer } from "@/lib/viewer";
import FrozenGuard from "@/components/layout/FrozenGuard";
import InputGuard from "@/components/layout/InputGuard";
import ErrorReporter from "@/components/ErrorReporter";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import "./globals.css";

// Outfit for Latin text and the wordmark, Noto Sans Armenian for Armenian.
// Both are variable fonts kept in ./fonts (SIL Open Font License), so a
// build never depends on reaching Google Fonts.
const outfit = localFont({ src: "./fonts/outfit-latin.woff2", weight: "500 700", variable: "--font-outfit", display: "swap" });
const notoArmenian = localFont({ src: "./fonts/noto-sans-armenian.woff2", weight: "400 700", variable: "--font-noto-armenian", display: "swap" });

// Link previews (Facebook, Telegram, WhatsApp, Viber…): pages without their
// own picture show the Culmen card. Addresses are made absolute from the site URL.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://bolbol.am"),
  title: { default: "Culmen", template: "%s" },
  description: "Հայաստանի արշավական ակումբներն ու նրանց արշավները՝ մեկ հարթակում։",
  openGraph: {
    type: "website",
    siteName: "Culmen",
    locale: "hy_AM",
    images: [{ url: "/brand/og-default.jpg", width: 1200, height: 630, alt: "Culmen" }],
  },
  twitter: { card: "summary_large_image" },
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
          <ErrorReporter />
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
