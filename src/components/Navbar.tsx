"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/about", label: "Մեր մասին" },
  { href: "/tours", label: "Արշավներ" },
  { href: "/clubs", label: "Ակումբներ" },
  { href: "/faq", label: "ՀՈՒՊ" },
];

type AuthState = {
  loggedIn: boolean;
  role: "individual" | "club" | null;
  unread: number;
};

export default function Navbar() {
  const [auth, setAuth] = useState<AuthState>({ loggedIn: false, role: null, unread: 0 });
  const router = useRouter();
  const pathname = usePathname();

  async function refreshAuth() {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setAuth({ loggedIn: false, role: null, unread: 0 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    const role = (profile?.role as "individual" | "club") ?? null;

    let unread = 0;
    if (role === "individual") {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id)
        .eq("read", false);
      unread = count ?? 0;
    }
    setAuth({ loggedIn: true, role, unread });
  }

  useEffect(() => {
    refreshAuth();
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refreshAuth());
    return () => sub.subscription.unsubscribe();
  }, []);

  // Re-check the unread badge after navigating (e.g. leaving the inbox).
  useEffect(() => {
    refreshAuth();
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-stone/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link href="/" className="text-lg font-bold text-pine">
          🏔️ Highland
        </Link>
        <nav className="order-3 flex w-full gap-6 text-sm font-medium text-neutral-700 sm:order-none sm:w-auto">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-apricot">
              {l.label}
            </Link>
          ))}
          {auth.role === "club" && (
            <Link href="/dashboard" className="font-semibold text-apricot hover:text-apricot-dark">
              Վահանակ
            </Link>
          )}
          {auth.role === "individual" && (
            <>
              <Link
                href="/account/notifications"
                className="relative font-semibold text-apricot hover:text-apricot-dark"
                title="Ծանուցումներ"
              >
                🔔
                {auth.unread > 0 && (
                  <span className="absolute -right-2.5 -top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
                    {auth.unread}
                  </span>
                )}
              </Link>
              <Link href="/account" className="font-semibold text-apricot hover:text-apricot-dark">
                Իմ էջը
              </Link>
            </>
          )}
        </nav>
        <div className="flex gap-2">
          {auth.loggedIn ? (
            <button
              onClick={handleLogout}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold"
            >
              Ելք
            </button>
          ) : (
            <>
              <Link href="/login" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold">
                Մուտք
              </Link>
              <Link href="/register" className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white">
                Գրանցվել
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
