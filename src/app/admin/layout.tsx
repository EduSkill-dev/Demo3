import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DashboardShell, { type ShellItem } from "@/components/ui/DashboardShell";
import PasswordForm from "@/components/admin/PasswordForm";
import { can, getAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminNav, { type NavEntry } from "@/components/admin/AdminNav";
import KeyGate from "@/components/admin/KeyGate";

export const metadata: Metadata = { title: "Ադմինի վահանակ", robots: { index: false } };

// The admin area (Armenian only). src/middleware.ts lets only admin accounts
// in; each page checks its own permission again.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin");

  // A new device of a key holder opens nothing before the key.
  if (me.needsKey) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-2xl font-semibold text-heading">Հաստատեք սարքը</h1>
        <div className="mt-6">
          <KeyGate />
        </div>
      </main>
    );
  }

  // A one-time password opens nothing but the form that replaces it.
  if (me.mustChangePassword) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-2xl font-semibold text-heading">Սահմանեք գաղտնաբառ</h1>
        <div className="mt-6">
          <PasswordForm forced />
        </div>
      </main>
    );
  }

  // Gor's order (2026-10-20); an admin sees only the sections they may
  // manage, and may arrange them their own way (admins.nav_order).
  const settings = [
    ...(me.isSuper ? [{ key: "admins", href: "/admin/admins", label: "Ադմիններ" }] : []),
    ...(me.isSuper ? [{ key: "plans", href: "/admin/plans", label: "Փաթեթներ" }] : []),
    ...(can(me, "pages") ? [{ key: "sights", href: "/admin/sights", label: "Տեսարժան վայրեր" }] : []),
    ...(can(me, "pages") ? [{ key: "pages", href: "/admin/pages", label: "Կայքի էջերը" }] : []),
    ...(can(me, "pages") ? [{ key: "share", href: "/admin/share", label: "Սոց. ցանցեր" }] : []),
    ...(can(me, "news") ? [{ key: "news", href: "/admin/news", label: "Հարթակի նորությունները" }] : []),
  ];
  const entries: NavEntry[] = [
    { key: "home", href: "/admin", label: "Ընդհանուր" },
    { key: "notifications", href: "/admin/notifications", label: "Ծանուցումներ" },
    ...(can(me, "clubs") ? [{ key: "clubs", href: "/admin/clubs", label: "Ակումբներ" }] : []),
    ...(can(me, "tours") ? [{ key: "tours", href: "/admin/tours", label: "Հայտարարություններ" }] : []),
    ...(can(me, "individuals") ? [{ key: "individuals", href: "/admin/individuals", label: "Անհատներ" }] : []),
    ...(can(me, "individuals") ? [{ key: "requests", href: "/admin/requests", label: "Անհատների հայտեր" }] : []),
    ...(settings.length ? [{ key: "settings", label: "Հարթակի կարգավորումներ", children: settings }] : []),
    ...(can(me, "messages") ? [{ key: "messages", href: "/admin/messages", label: "Հաղորդագրություններ" }] : []),
    { key: "logs", href: "/admin/logs", label: "Լոգեր" },
    { key: "errors", href: "/admin/errors", label: "Սխալներ" },
    { key: "security", href: "/admin/security", label: "Պաշտպանություն" },
    { key: "me", href: "/admin/password", label: "Ադմինի տվյալներ" },
  ];
  const items: ShellItem[] = entries.flatMap((e) => (e.children ? e.children : [{ href: e.href!, label: e.label }]));
  const { data: navRow } = await createAdminClient().from("admins").select("nav_order").eq("user_id", me.userId).maybeSingle();

  return (
    <DashboardShell wide title={me.isSuper ? "Սուպեր ադմինի վահանակ" : "Ադմինի վահանակ"} items={items} nav={<AdminNav entries={entries} saved={(navRow as { nav_order: string[] | null } | null)?.nav_order ?? null} />}>
      {children}
    </DashboardShell>
  );
}
