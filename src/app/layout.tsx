import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="hy">
      <body className="bg-stone text-neutral-900">{children}</body>
    </html>
  );
}
