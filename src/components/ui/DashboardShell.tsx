"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CountBadge from "./CountBadge";

export type ShellItem = { href: string; label: string; badge?: number };

// Left-hand section list with the current section on the right. On phones the
// list becomes a horizontally scrolling strip above the content.
export default function DashboardShell({
  title,
  items,
  children,
}: {
  title: string;
  items: ShellItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The longest matching prefix wins, so /dashboard/applications does not
  // also light up /dashboard.
  const active = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-serif text-2xl font-semibold text-heading">{title}</h1>
      <div className="mt-6 md:grid md:grid-cols-[13rem_1fr] md:gap-8">
        <nav
          aria-label={title}
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 pb-2 md:mx-0 md:flex-col md:self-start md:overflow-visible md:rounded-xl md:border md:bg-surface md:p-2"
        >
          {items.map((item) => {
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-apricot/10 text-apricot-dark dark:text-apricot"
                    : "text-muted hover:bg-sand/60 hover:text-ink"
                }`}
              >
                {item.label}
                {item.badge ? <CountBadge count={item.badge} /> : null}
              </Link>
            );
          })}
        </nav>
        <section className="mt-6 min-w-0 md:mt-0">{children}</section>
      </div>
    </main>
  );
}
