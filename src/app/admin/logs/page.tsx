import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdmin } from "@/lib/admin";
import { ACTION_LABELS, ROLE_LABELS } from "@/lib/adminLabels";
import { adminGhost, adminInput } from "@/components/admin/adminApi";

const PAGE_SIZE = 50;

type Entry = {
  id: number;
  at: string;
  actor_role: string | null;
  actor_label: string | null;
  action: string;
  target_label: string | null;
  ip: string | null;
  meta: Record<string, unknown>;
};

// Log times are shown in Armenian time, to the second.
const stamp = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Yerevan",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function details(e: Entry): string {
  const m = e.meta ?? {};
  const parts: string[] = [];
  if (e.target_label) parts.push(e.target_label);
  if (Array.isArray(m.fields)) parts.push(`դաշտեր՝ ${(m.fields as string[]).join(", ")}`);
  if (Array.isArray(m.perms)) parts.push(`թույլտվություններ՝ ${(m.perms as string[]).join(", ") || "չկան"}`);
  if (m.amount != null) parts.push(`${m.amount} ֏${m.kind === "subscription" ? ` · փաթեթ ${m.tariff ?? ""}` : ""}`);
  if (m.score != null) parts.push(`${m.score}/5`);
  if (m.via) parts.push("երկրորդ հասցեով");
  return parts.join(" · ");
}

// Who did what, when and from where. The super admin sees everyone (admins
// included); a regular admin sees only individuals and clubs.
export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: { role?: string; action?: string; q?: string; page?: string };
}) {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin/logs");

  const roles = me.isSuper ? ["individual", "club", "admin", "super"] : ["individual", "club"];
  const role = roles.includes(searchParams.role ?? "") ? searchParams.role! : "";
  const action = searchParams.action && searchParams.action in ACTION_LABELS ? searchParams.action : "";
  const q = (searchParams.q ?? "").trim().replace(/[,()%*\\]/g, " ").slice(0, 80);
  const page = Math.max(1, Number(searchParams.page) || 1);

  let query = createAdminClient()
    .from("activity_log")
    .select("id, at, actor_role, actor_label, action, target_label, ip, meta", { count: "exact" })
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  query = role ? query.eq("actor_role", role) : query.in("actor_role", roles);
  if (action) query = query.eq("action", action);
  if (q) query = query.or(`actor_label.ilike.%${q}%,target_label.ilike.%${q}%,ip.ilike.%${q}%`);
  const { data, count } = await query;
  const entries = (data ?? []) as Entry[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const actions = Object.entries(ACTION_LABELS).filter(([key]) => me.isSuper || !key.startsWith("admin."));
  const link = (p: number) => {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (action) params.set("action", action);
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/admin/logs?${params}`;
  };

  return (
    <div>
      <h2 className="font-serif text-xl font-semibold text-heading">Լոգեր ({count ?? 0})</h2>

      <form className="mt-4 flex flex-wrap items-end gap-2">
        <select name="role" defaultValue={role} aria-label="Օգտվողի տեսակ" className={`${adminInput} w-44`}>
          <option value="">Բոլոր օգտվողները</option>
          {roles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select name="action" defaultValue={action} aria-label="Գործողություն" className={`${adminInput} w-64`}>
          <option value="">Բոլոր գործողությունները</option>
          {actions.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="Անուն, էլ. հասցե, IP" aria-label="Փնտրել" className={`${adminInput} w-56`} />
        <button type="submit" className={adminGhost}>Զտել</button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Երբ</th>
              <th className="px-4 py-3">Ով</th>
              <th className="px-4 py-3">Գործողություն</th>
              <th className="px-4 py-3">Մանրամասներ</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">Գրառում չկա։</td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-line align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{stamp.format(new Date(e.at))}</td>
                <td className="px-4 py-2.5">
                  <span className="block break-all text-ink">{e.actor_label || "—"}</span>
                  <span className="text-xs text-muted">{ROLE_LABELS[e.actor_role ?? ""] ?? "—"}</span>
                </td>
                <td className="px-4 py-2.5 font-medium text-ink">{ACTION_LABELS[e.action] ?? e.action}</td>
                <td className="break-words px-4 py-2.5 text-muted">{details(e)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted">{e.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Էջեր">
          {page > 1 ? <Link href={link(page - 1)} className={adminGhost}>← Ավելի նոր</Link> : <span />}
          <span className="text-muted">Էջ {page} / {pages}</span>
          {page < pages ? <Link href={link(page + 1)} className={adminGhost}>Ավելի հին →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
