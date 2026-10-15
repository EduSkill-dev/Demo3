import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { getFormatDate, getT } from "@/i18n/server";
import SearchBox from "@/components/admin/SearchBox";
import { SortLink, readSort, sortRows, type SortState } from "@/components/admin/Sortable";

type Raw = {
  id: string;
  user_id: string;
  author_name: string;
  people: number;
  date_from: string;
  date_to: string;
  regions: string[];
  status: "open" | "accepted" | "closed";
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null; email: string } | null;
  tour_offers: { status: "pending" | "accepted" | "declined" | "withdrawn"; date: string; clubs: { name: string } | null }[];
};

// What the list shows, worked out from the request and its offers.
const STATES = {
  waiting: { label: "Սպասում է առաջարկի", hint: "ոչ մի ակումբ դեռ չի արձագանքել", tone: "bg-sand text-muted" },
  pending: { label: "Սպասման մեջ է", hint: "ակումբն առաջարկել է, անհատը դեռ չի պատասխանել", tone: "bg-apricot-100 text-apricot-700" },
  confirmed: { label: "Հաստատված է", hint: "անհատն ընդունել է առաջարկը", tone: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" },
  finished: { label: "Ավարտված է", hint: "ընդունված առաջարկի արշավն արդեն կայացել է", tone: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300" },
  cancelled: { label: "Չեղարկված է", hint: "անհատը փակել է իր հայտը", tone: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
} as const;
type State = keyof typeof STATES;

function stateOf(r: Raw, today: string): State {
  if (r.status === "closed") return "cancelled";
  if (r.status === "accepted") {
    const accepted = r.tour_offers.find((o) => o.status === "accepted");
    return (accepted?.date ?? r.date_to) < today ? "finished" : "confirmed";
  }
  return r.tour_offers.some((o) => o.status === "pending") ? "pending" : "waiting";
}

const th = "whitespace-nowrap px-3 py-2.5 font-semibold";
const td = "whitespace-nowrap px-3 py-2";

// Individuals' custom hike requests: who left it, when, and where it stands.
// Read-only — the request and its offers belong to the people involved.
export default async function AdminRequestsPage({ searchParams }: { searchParams: { q?: string; state?: string; sort?: string; dir?: string } }) {
  const me = await getAdmin();
  if (!me || !can(me, "individuals")) redirect("/admin");

  const [t, fmt] = await Promise.all([getT(), getFormatDate()]);
  const { data } = await createAdminClient()
    .from("tour_requests")
    .select("id, user_id, author_name, people, date_from, date_to, regions, status, created_at, profiles(first_name, last_name, email), tour_offers(status, date, clubs(name))")
    .order("created_at", { ascending: false })
    .limit(1000);

  const today = new Date().toISOString().slice(0, 10);
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const only = Object.prototype.hasOwnProperty.call(STATES, searchParams.state ?? "") ? (searchParams.state as State) : null;
  const all = ((data ?? []) as unknown as Raw[]).map((r) => ({
    ...r,
    state: stateOf(r, today),
    name: [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(" ") || r.author_name || "—",
    offers: r.tour_offers.filter((o) => o.status !== "withdrawn"),
    club: r.tour_offers.find((o) => o.status === "accepted")?.clubs?.name ?? null,
  }));
  const found = all.filter((r) => !q || `${r.name} ${r.profiles?.email ?? ""}`.toLowerCase().includes(q));
  // Cancelled requests are noise in the everyday list: they show only when asked for.
  const live = found.filter((r) => r.state !== "cancelled");
  // Newest first; the headers sort (again = reversed).
  const sort = readSort(searchParams, ["name", "created", "dates", "people", "offers", "club"], { col: "created", dir: "desc" });
  const rows = sortRows(only ? found.filter((r) => r.state === only) : live, {
    name: (r) => r.name,
    created: (r) => r.created_at,
    dates: (r) => r.date_from,
    people: (r) => r.people,
    offers: (r) => r.offers.length,
    club: (r) => r.club,
  }, sort);
  const href = (state: State | null, order: SortState | null = null) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (state) p.set("state", state);
    if (order) {
      p.set("sort", order.col);
      p.set("dir", order.dir);
    }
    const s = p.toString();
    return s ? `/admin/requests?${s}` : "/admin/requests";
  };
  const sortHref = (order: SortState) => href(only, order);
  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? "border-spruce-500 bg-spruce-500 text-white" : "border-line bg-surface text-ink hover:border-spruce-500"}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-heading">Անհատների հայտեր ({rows.length})</h2>
        <SearchBox placeholder="Փնտրել ըստ անվան կամ էլ. հասցեի" keep={{ state: only ?? undefined }} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href={href(null)} title="Բոլորը, բացի չեղարկվածներից" className={chip(!only)}>Բոլորը · {live.length}</Link>
        {(Object.keys(STATES) as State[]).map((s) => (
          <Link key={s} href={href(s)} title={STATES[s].hint} className={chip(only === s)}>
            {STATES[s].label} · {found.filter((r) => r.state === s).length}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className={th}><SortLink label="Անհատ" col="name" sort={sort} href={sortHref} /></th>
              <th className={`${th} text-center`}><SortLink label="Ստեղծվել է" col="created" sort={sort} href={sortHref} /></th>
              <th className={`${th} text-center`}><SortLink label="Ցանկալի օրեր" col="dates" sort={sort} href={sortHref} /></th>
              <th className={th}>Մարզեր</th>
              <th className={`${th} text-center`}><SortLink label="Մարդ" col="people" sort={sort} href={sortHref} /></th>
              <th className={`${th} text-center`}><SortLink label="Առաջարկներ" col="offers" sort={sort} href={sortHref} /></th>
              <th className={`${th} text-center`}>Վիճակ</th>
              <th className={th}><SortLink label="Ակումբ" col="club" sort={sort} href={sortHref} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted">Հայտ չի գտնվել։</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className={td}>
                  <div className="w-[13rem]">
                    <span className="block truncate font-medium text-ink" title={r.name}>{r.name}</span>
                    <span className="block truncate text-xs text-muted" title={r.profiles?.email}>{r.profiles?.email ?? "—"}</span>
                  </div>
                </td>
                <td className={`${td} text-center text-muted`}>{fmt(r.created_at, "dateTime")}</td>
                <td className={`${td} text-center text-muted`}>
                  {fmt(r.date_from, "short")}
                  {r.date_to !== r.date_from ? ` – ${fmt(r.date_to, "short")}` : ""}
                </td>
                <td className={`${td} text-muted`}>
                  <span className="block max-w-[12rem] truncate" title={r.regions.map((k) => t(`region.${k}`)).join(", ")}>
                    {r.regions.map((k) => t(`region.${k}`)).join(", ") || "—"}
                  </span>
                </td>
                <td className={`${td} text-center text-muted`}>{r.people}</td>
                <td className={`${td} text-center text-muted`}>{r.offers.length}</td>
                <td className={`${td} text-center`}>
                  <span title={STATES[r.state].hint} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATES[r.state].tone}`}>
                    {STATES[r.state].label}
                  </span>
                </td>
                <td className={`${td} text-muted`}>{r.club ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Վիճակի վրա պահեք մկնիկը՝ բացատրությունը տեսնելու համար։ Չեղարկված հայտերը երևում են միայն իրենց ֆիլտրով։ Հայտերն այստեղ միայն դիտվում են։</p>
    </div>
  );
}
