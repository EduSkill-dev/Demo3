import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hy" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="bg-stone font-sans text-neutral-900">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
