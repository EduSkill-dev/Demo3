import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DashboardShell, { type ShellItem } from "@/components/ui/DashboardShell";
import PasswordForm from "@/components/admin/PasswordForm";
import { can, getAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Ադմինի վահանակ | Highland", robots: { index: false } };

// The admin area (Armenian only). src/middleware.ts lets only admin accounts
// in; each page checks its own permission again.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin");

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

  const items: ShellItem[] = [
    { href: "/admin", label: "Ընդհանուր" },
    ...(can(me, "pages") ? [{ href: "/admin/pages", label: "Կայքի էջեր" }] : []),
    ...(can(me, "pages") ? [{ href: "/admin/sights", label: "Տեսարժան վայրեր" }] : []),
    ...(can(me, "tours") ? [{ href: "/admin/tours", label: "Հայտարարություններ" }] : []),
    ...(can(me, "clubs") ? [{ href: "/admin/clubs", label: "Ակումբներ" }] : []),
    ...(can(me, "individuals") ? [{ href: "/admin/individuals", label: "Անհատներ" }] : []),
    ...(me.isSuper ? [{ href: "/admin/admins", label: "Ադմիններ" }] : []),
    { href: "/admin/logs", label: "Լոգեր" },
    { href: "/admin/password", label: "Գաղտնաբառ" },
  ];

  return (
    <DashboardShell wide title={me.isSuper ? "Սուպեր ադմինի վահանակ" : "Ադմինի վահանակ"} items={items}>
      {children}
    </DashboardShell>
  );
}
