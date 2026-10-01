"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const tabs = [
  { href: "/account", label: "Իմ արշավները" },
  { href: "/account/history", label: "Պատմություն" },
  { href: "/account/favorites", label: "Սիրված ակումբներ" },
  { href: "/account/comments", label: "Մեկնաբանություններ" },
  { href: "/account/profile", label: "Անձնական տվյալներ" },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "ok" | "denied">("checking");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (active) setStatus("denied");
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();
      if (!active) return;
      if (profile?.role === "individual") setStatus("ok");
      else {
        setStatus("denied");
        router.replace("/dashboard");
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (status !== "ok") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-neutral-500">
        {status === "checking" ? "Ստուգվում է..." : "Վերահղում..."}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-serif text-2xl font-semibold text-pine">Իմ էջը</h1>
      <nav className="mt-6 flex flex-wrap gap-2 border-b border-sand">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              pathname === t.href ? "border-apricot text-pine" : "border-transparent text-neutral-500"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">{children}</div>
    </main>
  );
}
