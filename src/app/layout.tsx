import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getTheme } from "@/i18n/server";
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

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${inter.variable}${theme === "dark" ? " dark" : ""}`}
    >
      <body className="bg-stone font-sans text-ink">
        <I18nProvider locale={locale}>
          <Navbar />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
