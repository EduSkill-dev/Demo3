"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";

const LINKS = [
  { href: "/about", key: "header.about" },
  { href: "/tours", key: "header.tours" },
  { href: "/clubs", key: "header.clubs" },
  { href: "/faq", key: "header.faq" },
  { href: "/terms", key: "footer.terms" },
  { href: "/privacy", key: "footer.privacy" },
  { href: "/help", key: "footer.help" },
] as const;

// The page you are on is highlighted, so the footer doubles as a "you are here".
export default function FooterLinks() {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav aria-label="footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "font-semibold text-terracotta-500 underline decoration-2 underline-offset-4"
                : "text-white/75 hover:text-white"
            }
          >
            {t(l.key)}
          </Link>
        );
      })}
    </nav>
  );
}
