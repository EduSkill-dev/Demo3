"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/about", label: "Մեր մասին" },
  { href: "/tours", label: "Արշավներ" },
  { href: "/clubs", label: "Ակումբներ" },
  { href: "/faq", label: "ՀՈՒՊ" },
];

type AuthState = { loggedIn: boolean; role: "individual" | "club" | null };

export default function Navbar() {
  const [auth, setAuth] = useState<AuthState>({ loggedIn: false, role: null });
  const router = useRouter();

  async function refreshAuth() {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setAuth({ loggedIn: false, role: null });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    setAuth({ loggedIn: true, role: (profile?.role as "individual" | "club") ?? null });
  }

  useEffect(() => {
    refreshAuth();
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refreshAuth());
    return () => sub.subscription.unsubscribe();
  }, []);

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
            <Link href="/account" className="font-semibold text-apricot hover:text-apricot-dark">
              Իմ էջը
            </Link>
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
