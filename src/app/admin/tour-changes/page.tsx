import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { getT } from "@/i18n/server";
import Pager, { readPageSize } from "@/components/admin/Pager";
import { CHANGE_REASONS, changedLines, type ChangeReason, type TourChangeFacts } from "@/lib/tourChangeReasons";

type Row = {
  id: number;
  tour_id: string | null;
  club_id: string | null;
  tour_title: string;
  kind: "change" | "cancel";
  reason: ChangeReason | null;
  note: string | null;
  before: TourChangeFacts | null;
  after: TourChangeFacts | null;
  participants: number;
  changed_at: string;
  notified_at: string | null;
  clubs: { name: string } | null;
};

const stamp = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yerevan", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const th = "whitespace-nowrap px-3 py-2.5 font-semibold";

// What clubs changed or cancelled on hikes people had booked: what it was, what
// it became and why.
export default async function AdminTourChangesPage({ searchParams }: { searchParams: { page?: string; size?: string } }) {
  const me = await getAdmin();
  if (!me || !can(me, "tours")) redirect("/admin");

  const t = await getT();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const size = readPageSize(searchParams.size);
  const { data, count } = await createAdminClient()
    .from("tour_changes")
    .select("id, tour_id, club_id, tour_title, kind, reason, note, before, after, participants, changed_at, notified_at, clubs(name)", { count: "exact" })
    .order("changed_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  const rows = (data ?? []) as unknown as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / size));
  const link = (p: number, n: number) => {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    if (n !== 50) params.set("size", String(n));
    const search = params.toString();
    return search ? `/admin/tour-changes?${search}` : "/admin/tour-changes";
  };
  const back = encodeURIComponent("/admin/tour-changes");

  return (
    <div>
      <h2 className="font-serif text-xl font-semibold text-heading">Արշավների փոփոխություններ ({count ?? 0})</h2>
      <p className="mt-1 text-xs text-muted">Ամրագրումներ ունեցող արշավների փոփոխությունները և չեղարկումները։</p>
      <div id="changes" className="mt-4 scroll-mt-24 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className={th}>Երբ</th>
              <th className={th}>Արշավ</th>
              <th className={th}>Պատճառ</th>
              <th className={th}>Ինչ փոխվեց</th>
              <th className={th}>Մասնակիցներ</th>
              <th className={th}>Նամակներ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">Փոփոխություններ չկան։</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5 text-muted">{stamp.format(new Date(r.changed_at))}</td>
                <td className="min-w-48 px-3 py-2.5">
                  {r.tour_id ? (
                    <Link href={`/tours/${r.tour_id}?back=${back}`} className="block font-medium text-ink hover:text-terracotta-700 hover:underline">{r.tour_title}</Link>
                  ) : (
                    <span className="block font-medium text-ink">{r.tour_title}</span>
                  )}
                  {r.club_id && <Link href={`/clubs/${r.club_id}?back=${back}`} className="text-xs text-muted hover:text-terracotta-700 hover:underline">{r.clubs?.name}</Link>}
                </td>
                <td className="min-w-40 px-3 py-2.5">
                  {r.kind === "cancel" ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">Չեղարկում</span>
                  ) : (
                    <span className="text-ink">{r.reason ? t(CHANGE_REASONS[r.reason]) : "—"}</span>
                  )}
                  {r.note && <span className="mt-0.5 block break-words text-xs text-muted">{r.note}</span>}
                </td>
                <td className="min-w-64 px-3 py-2.5">
                  <ul className="space-y-1">
                    {changedLines(r.before, r.after).map(([label, was, now]) => (
                      <li key={label} className="break-words">
                        <span className="text-xs text-muted">{label}՝ </span>
                        <span className="text-muted line-through">{was}</span> <span aria-hidden>→</span> <span className="font-medium text-ink">{now}</span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ink">{r.participants}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted">{r.notified_at ? "Ուղարկված" : "Սպասում է"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(count ?? 0) > 25 && <Pager page={Math.min(page, pages)} pages={pages} size={size} href={link} anchor="changes" />}
    </div>
  );
}
