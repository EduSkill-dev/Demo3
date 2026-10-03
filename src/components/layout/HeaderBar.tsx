"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import ThemeToggle from "@/components/ui/ThemeToggle";
import CountBadge from "@/components/ui/CountBadge";

export type HeaderUser = { role: "individual" | "club"; name: string; unread: number };

export const NAV_LINKS = [
  { href: "/about", key: "header.about" },
  { href: "/tours", key: "header.tours" },
  { href: "/clubs", key: "header.clubs" },
  { href: "/faq", key: "header.faq" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function HeaderBar({ user }: { user: HeaderUser | null }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const registerRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation, outside click and Escape.
  useEffect(() => {
    setMobileOpen(false);
    setRegisterOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!registerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!registerRef.current?.contains(e.target as Node)) setRegisterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRegisterOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [registerOpen]);

  async function logout() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const home = user ? (user.role === "club" ? "/dashboard" : "/account") : null;
  const homeLabel = user?.role === "club" ? t("header.dashboard") : t("header.account");
  const navLink = (href: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive(pathname, href) ? "text-apricot-dark dark:text-apricot" : "text-ink hover:text-apricot-dark"
    }`;

  const registerMenu = (
    <div
      role="menu"
      className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
    >
      <Link role="menuitem" href="/register?as=individual" className="block px-4 py-3 hover:bg-sand/60">
        <span className="block text-sm font-semibold text-ink">🥾 {t("header.asIndividual")}</span>
        <span className="block text-xs text-muted">{t("header.asIndividualHint")}</span>
      </Link>
      <Link role="menuitem" href="/register/club" className="block border-t border-line px-4 py-3 hover:bg-sand/60">
        <span className="block text-sm font-semibold text-ink">🏕️ {t("header.asClub")}</span>
        <span className="block text-xs text-muted">{t("header.asClubHint")}</span>
      </Link>
    </div>
  );

  const bell =
    user?.role === "individual" ? (
      <Link
        href="/account/notifications"
        aria-label={t("header.notifications")}
        title={t("header.notifications")}
        className="relative rounded-lg p-2 text-muted hover:bg-sand hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <CountBadge count={user.unread} className="absolute -right-0.5 -top-0.5" />
      </Link>
    ) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-stone/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0 text-lg font-bold text-heading">
          🏔️ Highland
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="main">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={navLink(l.href)} aria-current={isActive(pathname, l.href) ? "page" : undefined}>
              {t(l.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              {bell}
              <Link
                href={home!}
                className="max-w-[16rem] truncate rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:text-apricot-dark"
                title={homeLabel}
              >
                {t("header.hello", { name: user.name || homeLabel })}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-apricot"
              >
                {t("header.logout")}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-apricot">
                {t("header.login")}
              </Link>
              <div className="relative" ref={registerRef}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={registerOpen}
                  onClick={() => setRegisterOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark"
                >
                  {t("header.register")}
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 8l5 5 5-5" /></svg>
                </button>
                {registerOpen && registerMenu}
              </div>
            </>
          )}
          <span className="mx-1 h-6 w-px bg-line" aria-hidden />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* Phones and tablets */}
        <div className="ml-auto flex items-center gap-1 lg:hidden">
          {bell}
          <ThemeToggle />
          <button
            type="button"
            aria-label={t("header.menu")}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg p-2 text-ink hover:bg-sand"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-stone px-4 pb-5 pt-2 lg:hidden">
          <nav className="flex flex-col" aria-label="main">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={navLink(l.href)}>
                {t(l.key)}
              </Link>
            ))}
          </nav>
          <div className="mt-3 space-y-2 border-t border-line pt-4">
            {user ? (
              <>
                <Link href={home!} className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink">
                  {t("header.hello", { name: user.name || homeLabel })} · {homeLabel}
                </Link>
                <button type="button" onClick={logout} className="w-full rounded-lg border border-line py-2.5 text-sm font-semibold text-ink">
                  {t("header.logout")}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="block rounded-lg border border-line py-2.5 text-center text-sm font-semibold text-ink">
                  {t("header.login")}
                </Link>
                <Link href="/register?as=individual" className="block rounded-lg bg-apricot py-2.5 text-center text-sm font-semibold text-white">
                  {t("header.register")} — {t("header.asIndividual")}
                </Link>
                <Link href="/register/club" className="block rounded-lg border border-apricot py-2.5 text-center text-sm font-semibold text-apricot-dark dark:text-apricot">
                  {t("header.register")} — {t("header.asClub")}
                </Link>
              </>
            )}
            <div className="pt-2">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
