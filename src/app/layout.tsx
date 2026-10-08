import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getTheme } from "@/i18n/server";
import { getSiteTexts } from "@/lib/siteTexts";
import { getViewer } from "@/lib/viewer";
import FrozenGuard from "@/components/layout/FrozenGuard";
import InputGuard from "@/components/layout/InputGuard";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Highland — hikes & tours across Armenia",
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
      className={`${fraunces.variable} ${inter.variable}${theme === "dark" ? " dark" : ""}`}
    >
      <body className="flex min-h-screen flex-col bg-stone font-sans text-ink">
        <I18nProvider locale={locale} overrides={overrides}>
          <InputGuard />
          <SiteHeader />
          {/* The header stays usable (language, theme, log out); a frozen
              account can only look at everything below it. */}
          <FrozenGuard active={!!viewer?.frozen}>
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </FrozenGuard>
        </I18nProvider>
      </body>
    </html>
  );
}
