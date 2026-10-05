import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { getFormatDate } from "@/i18n/server";
import TourToggle from "@/components/admin/TourToggle";
import SearchBox from "@/components/admin/SearchBox";

type Row = {
  id: string;
  title: string;
  date: string;
  status: "active" | "hidden" | "cancelled";
  admin_hidden: boolean;
  clubs: { name: string } | null;
};

const STATUS: Record<Row["status"], string> = { active: "Ակտիվ", hidden: "Թաքցված (ակումբի կողմից)", cancelled: "Չեղարկված" };

// Listings cannot be edited here — only taken off the site and put back.
export default async function AdminToursPage({ searchParams }: { searchParams: { q?: string } }) {
  const me = await getAdmin();
  if (!me || !can(me, "tours")) redirect("/admin");

  const fmt = await getFormatDate();
  const { data } = await createAdminClient()
    .from("tours")
    .select("id, title, date, status, admin_hidden, clubs(name)")
    .order("date", { ascending: false })
    .limit(1000);
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const rows = ((data ?? []) as unknown as Row[]).filter(
    (r) => !q || r.title.toLowerCase().includes(q) || (r.clubs?.name ?? "").toLowerCase().includes(q)
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-heading">Հայտարարություններ ({rows.length})</h2>
        <SearchBox placeholder="Փնտրել ըստ անվան կամ ակումբի" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Արշավ</th>
              <th className="px-4 py-3">Ակումբ</th>
              <th className="px-4 py-3">Ամսաթիվ</th>
              <th className="px-4 py-3">Վիճակ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">Հայտարարություն չի գտնվել։</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/tours/${r.id}`} className="font-medium text-ink hover:text-apricot-dark">{r.title}</Link>
                </td>
                <td className="px-4 py-3 text-muted">{r.clubs?.name ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{fmt(r.date, "short")}</td>
                <td className="px-4 py-3">
                  {r.admin_hidden ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                      Փակված է ադմինի կողմից
                    </span>
                  ) : (
                    <span className="text-muted">{STATUS[r.status]}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <TourToggle tourId={r.id} hidden={r.admin_hidden} title={r.title} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
