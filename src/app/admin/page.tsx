import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { ADMIN_PERMS, PERM_LABELS } from "@/lib/adminLabels";

// Overview: the platform in numbers and what this admin may manage.
export default async function AdminHomePage() {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin");

  const db = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;
  const head = { count: "exact" as const, head: true };
  const [individuals, clubs, tours, closed, restricted, requests] = await Promise.all([
    count(db.from("profiles").select("id", head).eq("role", "individual")),
    count(db.from("profiles").select("id", head).eq("role", "club")),
    count(db.from("tours").select("id", head).eq("status", "active").gte("date", today)),
    count(db.from("tours").select("id", head).eq("admin_hidden", true)),
    count(db.from("profiles").select("id", head).neq("status", "active")),
    count(db.from("tour_requests").select("id", head).neq("status", "closed")),
  ]);

  // Each card opens its section when this admin may manage it. Frozen and
  // blocked accounts are spread over two sections, so that card is not a link.
  const stats: [string, number, string | null][] = [
    ["Անհատներ", individuals, can(me, "individuals") ? "/admin/individuals" : null],
    ["Ակումբներ", clubs, can(me, "clubs") ? "/admin/clubs" : null],
    ["Անհատների հայտեր", requests, can(me, "individuals") ? "/admin/requests" : null],
    ["Առաջիկա արշավներ", tours, can(me, "tours") ? "/admin/tours" : null],
    ["Փակված հայտարարություններ", closed, can(me, "tours") ? "/admin/tours" : null],
    ["Սառեցված / արգելափակված հաշիվներ", restricted, null],
  ];

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map(([label, value, href]) => {
          const body = (
            <>
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 font-serif text-2xl font-semibold text-heading">{value}</dd>
            </>
          );
          return href ? (
            <Link key={label} href={href} className="block rounded-xl border border-line bg-surface p-4 transition hover:border-spruce-500 hover:shadow-sm">
              {body}
            </Link>
          ) : (
            <div key={label} className="rounded-xl border border-line bg-surface p-4">{body}</div>
          );
        })}
      </dl>

      <section>
        <h2 className="font-serif text-lg font-semibold text-heading">Ձեր թույլտվությունները</h2>
        <p className="mt-1 text-sm text-muted">{me.email}</p>
        {me.isSuper ? (
          <p className="mt-3 text-sm text-ink">Սուպեր ադմին՝ հարթակի ամբողջական կառավարում, ադմինների ստեղծում և բոլոր լոգերը։</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {ADMIN_PERMS.map((k) => (
              <li key={k} className={can(me, k) ? "text-ink" : "text-muted line-through"}>
                {can(me, k) ? "✓" : "✕"} {PERM_LABELS[k]}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
