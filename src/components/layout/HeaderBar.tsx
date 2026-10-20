"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translate";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import ThemeToggle from "@/components/ui/ThemeToggle";
import CountBadge from "@/components/ui/CountBadge";
import CulmenLogo from "@/components/CulmenLogo";
import IdleLogout from "@/components/layout/IdleLogout";

export type HeaderUser = { role: "individual" | "club" | "admin"; name: string; unread: number };

// The main menu. "Hikes" opens a small menu (the hikes, the places). After it:
// clubs and hikers for everyone, then FAQ for individuals and visitors, or
// custom requests for clubs and admins. About and (for clubs) FAQ are in the
// footer.
type NavLink = { href: string; key: MessageKey };
const HIKES_MENU: NavLink[] = [
  { href: "/tours", key: "header.tours" },
  { href: "/places", key: "header.places" },
];
function navLinksFor(role: HeaderUser["role"] | null): NavLink[] {
  const shared: NavLink[] = [
    { href: "/clubs", key: "header.clubs" },
    { href: "/hikers", key: "header.hikers" },
  ];
  return role === "club" || role === "admin"
    ? [...shared, { href: "/requests", key: "requests.navLabel" }]
    : [...shared, { href: "/faq", key: "header.faq" }];
}

function isActive(pathname: string, href: string) {
  // The shared calendar is part of the hikes section.
  if (href === "/tours" && pathname === "/calendar") return true;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function HeaderBar({ user }: { user: HeaderUser | null }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [hikesOpen, setHikesOpen] = useState(false);
  const registerRef = useRef<HTMLDivElement>(null);
  const hikesRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation, outside click and Escape.
  useEffect(() => {
    setMobileOpen(false);
    setRegisterOpen(false);
    setHikesOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!hikesOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!hikesRef.current?.contains(e.target as Node)) setHikesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setHikesOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [hikesOpen]);
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

  const home = user ? (user.role === "admin" ? "/admin" : user.role === "club" ? "/dashboard" : "/account") : null;
  const homeLabel =
    user?.role === "admin" ? t("header.admin") : user?.role === "club" ? t("header.dashboard") : t("header.account");
  const links = navLinksFor(user?.role ?? null);
  const hikesActive = HIKES_MENU.some((l) => isActive(pathname, l.href));
  const navLink = (href: string) =>
    `whitespace-nowrap border-b-2 px-3 py-2 text-base font-semibold transition ${
      isActive(pathname, href)
        ? "border-terracotta-500 text-spruce-500 dark:text-spruce-300"
        : "border-transparent text-ink hover:text-spruce-500 dark:hover:text-spruce-300"
    }`;
  // Secondary button: transparent, 2px Spruce 900 border and text.
  const secondary =
    "rounded-lg border-2 border-spruce-900 px-4 py-1.5 text-sm font-semibold text-spruce-900 hover:bg-spruce-900 hover:text-card dark:border-ink dark:text-ink dark:hover:bg-ink dark:hover:text-spruce-900";

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
    user ? (
      <Link
        href={user.role === "admin" ? "/admin/notifications" : user.role === "club" ? "/dashboard/notifications" : "/account/notifications"}
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
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      {user && <IdleLogout minutes={user.role === "admin" ? 15 : 120} />}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="Culmen">
          <span className="dark:hidden"><CulmenLogo variant="light" size={40} wordmarkSize={30} gap={8} /></span>
          <span className="hidden dark:inline"><CulmenLogo variant="dark" size={40} wordmarkSize={30} gap={8} /></span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="main">
          {/* Hikes: opens on hover or click, with the hikes and the places. */}
          <div className="relative" ref={hikesRef} onMouseEnter={() => setHikesOpen(true)} onMouseLeave={() => setHikesOpen(false)}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={hikesOpen}
              onClick={() => setHikesOpen((v) => !v)}
              className={`${navLink(hikesActive ? pathname : "/__none")} flex items-center gap-1`}
            >
              {t("header.tours")}
              <svg viewBox="0 0 20 20" className={`h-4 w-4 transition ${hikesOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 8l5 5 5-5" />
              </svg>
            </button>
            {hikesOpen && (
              <div role="menu" className="absolute left-0 top-full z-40 w-56 pt-2">
                <div className="overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg">
                  {HIKES_MENU.map((l) => (
                    <Link
                      key={l.href}
                      role="menuitem"
                      href={l.href}
                      aria-current={isActive(pathname, l.href) ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${
                        isActive(pathname, l.href) ? "bg-spruce-500 text-[#FFFDF8]" : "text-ink hover:bg-sand"
                      }`}
                    >
                      {t(l.key)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          {links.map((l) => (
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
                className="max-w-[12rem] truncate rounded-lg px-2 py-2 text-sm font-semibold text-ink hover:text-terracotta-700"
                title={homeLabel}
              >
                {t("header.hello", { name: user.name || homeLabel })}
              </Link>
              <button
                type="button"
                onClick={logout}
                className={secondary}
              >
                {t("header.logout")}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={secondary}>
                {t("header.login")}
              </Link>
              <div className="relative" ref={registerRef}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={registerOpen}
                  onClick={() => setRegisterOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-lg bg-spruce-500 px-4 py-2 text-sm font-semibold text-white hover:bg-spruce-900"
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

        {/* Phones and tablets: the greeting, the bell and Log out (or, for a
            guest, Log in) stay in the bar; the rest is in the menu. */}
        <div className="ml-auto flex min-w-0 items-center gap-0.5 lg:hidden">
          {user ? (
            <Link
              href={home!}
              title={homeLabel}
              className="flex min-w-0 max-w-[11rem] items-center gap-1.5 rounded-lg px-1.5 py-2 text-sm font-semibold text-ink hover:text-terracotta-700 sm:max-w-[14rem]"
            >
              {/* Phones: just the name (the whole greeting does not fit beside the buttons). */}
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="7" r="3.2" /><path d="M3.5 17c.9-3 3.4-4.6 6.5-4.6s5.6 1.6 6.5 4.6" /></svg>
              <span className="truncate sm:hidden">{user.name || homeLabel}</span>
              <span className="truncate max-sm:hidden">{t("header.hello", { name: user.name || homeLabel })}</span>
            </Link>
          ) : (
            <Link href="/login" className="mr-1 rounded-lg border-2 border-spruce-900 px-3.5 py-1.5 text-sm font-semibold text-spruce-900 hover:bg-spruce-900 hover:text-card dark:border-ink dark:text-ink">
              {t("header.login")}
            </Link>
          )}
          {bell}
          {user && (
            <button type="button" onClick={logout} aria-label={t("header.logout")} title={t("header.logout")} className="rounded-lg p-2 text-muted hover:bg-sand hover:text-ink">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          )}
          {/* On phones the theme switch moves into the menu to leave room for the greeting. */}
          <span className="max-sm:hidden">
            <ThemeToggle />
          </span>
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
        <div className="border-t border-line bg-surface px-4 pb-5 pt-2 lg:hidden">
          <nav className="flex flex-col" aria-label="main">
            {[...HIKES_MENU, ...links].map((l) => (
              <Link key={l.href} href={l.href} className={navLink(l.href)}>
                {t(l.key)}
              </Link>
            ))}
          </nav>
          <div className="mt-3 space-y-2 border-t border-line pt-4">
            {user ? (
              <Link href={home!} className="block rounded-lg bg-spruce-500 py-2.5 text-center text-sm font-semibold text-white">
                {homeLabel}
              </Link>
            ) : (
              <>
                <Link href="/register?as=individual" className="block rounded-lg bg-spruce-500 py-2.5 text-center text-sm font-semibold text-white">
                  {t("header.register")} — {t("header.asIndividual")}
                </Link>
                <Link href="/register/club" className="block rounded-lg border border-terracotta-500 py-2.5 text-center text-sm font-semibold text-terracotta-700 dark:text-terracotta-300">
                  {t("header.register")} — {t("header.asClub")}
                </Link>
              </>
            )}
            <div className="flex items-center gap-2 pt-2">
              <LanguageSwitcher />
              <span className="sm:hidden">
                <ThemeToggle />
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
