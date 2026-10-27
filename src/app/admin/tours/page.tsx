import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { getFormatDate } from "@/i18n/server";
import TourToggle from "@/components/admin/TourToggle";
import SearchBox from "@/components/admin/SearchBox";
import { SortLink, readSort, sortRows, type SortState } from "@/components/admin/Sortable";
import AdminToursTable from "@/components/admin/AdminToursTable";
import { getPlans } from "@/lib/plans/server";
import { clubConfig } from "@/lib/plans/registry";

type Row = {
  id: string;
  title: string;
  date: string;
  status: "active" | "hidden" | "cancelled";
  admin_hidden: boolean;
  max_participants: number;
  clubs: { name: string; tariff: string | null; package_ends_at: string | null; plan_overrides: unknown; applications_blocked: boolean } | null;
};

const STATUS: Record<Row["status"], string> = { active: "Ակտիվ", hidden: "Թաքցված (ակումբի կողմից)", cancelled: "Չեղարկված" };

// Listings cannot be edited here — only taken off the site and put back.
// Newest first; the title, club and date headers sort (again = reversed).
export default async function AdminToursPage({ searchParams }: { searchParams: { q?: string; sort?: string; dir?: string } }) {
  const me = await getAdmin();
  if (!me || !can(me, "tours")) redirect("/admin");

  const fmt = await getFormatDate();
  const { data } = await createAdminClient()
    .from("tours")
    .select("id, title, date, status, admin_hidden, max_participants, clubs(name, tariff, package_ends_at, plan_overrides, applications_blocked)")
    .order("date", { ascending: false })
    .limit(1000);
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const sort = readSort(searchParams, ["title", "club", "date"], { col: "date", dir: "desc" });
  const rows = sortRows(
    ((data ?? []) as unknown as Row[]).filter((r) => !q || r.title.toLowerCase().includes(q) || (r.clubs?.name ?? "").toLowerCase().includes(q)),
    { title: (r) => r.title, club: (r) => r.clubs?.name ?? null, date: (r) => r.date },
    sort
  );
  // Seats as the cards count them: what the club's plan allows on this hike
  // (0 when sign-ups are closed), less the confirmed bookings.
  const db = createAdminClient();
  const [plans, { data: seatRows }] = await Promise.all([
    getPlans(),
    rows.length ? db.rpc("tours_seats_taken", { p_tours: rows.map((r) => r.id) }) : Promise.resolve({ data: [] }),
  ]);
  const taken = new Map(((seatRows ?? []) as { tour_id: string; taken: number }[]).map((x) => [x.tour_id, x.taken]));
  const seatsOf = (r: Row) => {
    const cap = !r.clubs || r.clubs.applications_blocked ? 0 : Math.min(r.max_participants, clubConfig(plans, r.clubs).max_participants_per_tour);
    return { free: Math.max(0, cap - (taken.get(r.id) ?? 0)), cap };
  };
  const sortHref = (x: SortState) => `/admin/tours?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), sort: x.col, dir: x.dir })}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-heading">Հայտարարություններ ({rows.length})</h2>
        <SearchBox placeholder="Փնտրել ըստ անվան կամ ակումբի" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <AdminToursTable
          empty="Հայտարարություն չի գտնվել։"
          head={
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3"><SortLink label="Արշավ" col="title" sort={sort} href={sortHref} /></th>
                <th className="px-4 py-3" title="Ազատ տեղեր / ընդհանուր">Տեղեր</th>
                <th className="px-4 py-3"><SortLink label="Ակումբ" col="club" sort={sort} href={sortHref} /></th>
                <th className="px-4 py-3"><SortLink label="Ամսաթիվ" col="date" sort={sort} href={sortHref} /></th>
                <th className="px-4 py-3">Վիճակ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
          }
          rows={rows.map((r) => ({
            id: r.id,
            title: <Link href={`/tours/${r.id}`} className="font-medium text-ink hover:text-terracotta-700">{r.title}</Link>,
            club: r.clubs?.name ?? "—",
            date: fmt(r.date, "short"),
            seats: seatsOf(r),
            status: r.admin_hidden ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">Փակված է ադմինի կողմից</span>
            ) : (
              <span className="text-muted">{STATUS[r.status]}</span>
            ),
            action: <TourToggle tourId={r.id} hidden={r.admin_hidden} title={r.title} />,
          }))}
        />
      </div>
    </div>
  );
}
