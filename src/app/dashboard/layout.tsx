"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const tabs = [
  { href: "/dashboard", label: "Հայտարարություններ" },
  { href: "/dashboard/applications", label: "Հայտեր" },
  { href: "/dashboard/comments", label: "Մեկնաբանություններ" },
  { href: "/dashboard/tariff", label: "Տարիֆ" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "ok" | "denied">("checking");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    async function check() {
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
      if (profile?.role === "club") setStatus("ok");
      else {
        setStatus("denied");
        router.replace("/");
      }
    }
    check();
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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-serif text-2xl font-semibold text-pine">Ակումբի վահանակ</h1>
      <nav className="mt-6 flex gap-2 border-b border-sand">
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
