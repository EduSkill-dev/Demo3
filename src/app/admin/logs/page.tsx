import Pager, { readPageSize } from "@/components/admin/Pager";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdmin } from "@/lib/admin";
import { ACTION_LABELS, PERM_LABELS, ROLE_LABELS, type AdminPerm } from "@/lib/adminLabels";
import { adminGhost, adminInlineInput } from "@/components/admin/adminApi";


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
  if (Array.isArray(m.perms)) parts.push(`թույլտվություններ՝ ${(m.perms as AdminPerm[]).map((k) => PERM_LABELS[k] ?? k).join(", ") || "չկան"}`);
  if (m.amount != null) parts.push(`${m.amount} ֏${m.kind === "subscription" ? ` · փաթեթ ${m.tariff ?? ""}` : ""}`);
  if (m.score != null) parts.push(`${m.score}/5`);
  if (m.via) parts.push("երկրորդ հասցեով");
  if (typeof m.limit === "string") parts.push(m.limit);
  if (typeof m.form === "string") parts.push(`ձև՝ ${m.form} · ${m.calls} հարցում · ${m.minutes} րոպեով`);
  return parts.join(" · ");
}

// Who did what, when and from where. The super admin sees everyone (admins
// included); a regular admin sees only individuals and clubs.
export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: { role?: string; action?: string; q?: string; page?: string; size?: string };
}) {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin/logs");

  const roles = me.isSuper ? ["individual", "club", "admin", "super"] : ["individual", "club"];
  const role = roles.includes(searchParams.role ?? "") ? searchParams.role! : "";
  const action = searchParams.action && searchParams.action in ACTION_LABELS ? searchParams.action : "";
  const q = (searchParams.q ?? "").trim().replace(/[,()%*\\]/g, " ").slice(0, 80);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const size = readPageSize(searchParams.size);

  let query = createAdminClient()
    .from("activity_log")
    .select("id, at, actor_role, actor_label, action, target_label, ip, meta", { count: "exact" })
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  // Without a filter the super admin also sees entries nobody "did" (the
  // abuse guard's blocks and pauses).
  if (role) query = query.eq("actor_role", role);
  else if (!me.isSuper) query = query.in("actor_role", roles);
  if (action) query = query.eq("action", action);
  if (q) query = query.or(`actor_label.ilike.%${q}%,target_label.ilike.%${q}%,ip.ilike.%${q}%`);
  const { data, count } = await query;
  const entries = (data ?? []) as Entry[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / size));

  const actions = Object.entries(ACTION_LABELS).filter(([key]) => me.isSuper || !(key.startsWith("admin.") || key.startsWith("security.")));
  const link = (p: number, n: number) => {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (action) params.set("action", action);
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    if (n !== 50) params.set("size", String(n));
    const query = params.toString();
    return query ? `/admin/logs?${query}` : "/admin/logs";
  };

  return (
    <div>
      <h2 className="font-serif text-xl font-semibold text-heading">Լոգեր ({count ?? 0})</h2>

      <form className="mt-4 flex flex-wrap items-end gap-2">
        {size !== 50 && <input type="hidden" name="size" value={size} />}
        <select name="role" defaultValue={role} aria-label="Օգտվողի տեսակ" className={`${adminInlineInput} w-44`}>
          <option value="">Բոլոր օգտվողները</option>
          {roles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select name="action" defaultValue={action} aria-label="Գործողություն" className={`${adminInlineInput} w-64 max-w-full`}>
          <option value="">Բոլոր գործողությունները</option>
          {actions.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="Անուն, էլ. հասցե, IP" aria-label="Փնտրել" className={`${adminInlineInput} w-56`} />
        <button type="submit" className={adminGhost}>Զտել</button>
      </form>

      <div id="log" className="mt-4 scroll-mt-24 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-[13px]">
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
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className="block text-ink">{e.actor_label || "—"}</span>
                  <span className="text-xs text-muted">{ROLE_LABELS[e.actor_role ?? ""] ?? "—"}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">{ACTION_LABELS[e.action] ?? e.action}</td>
                <td className="break-words px-4 py-2.5 text-muted">{details(e)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted">{e.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(count ?? 0) > 25 && <Pager page={Math.min(page, pages)} pages={pages} size={size} href={link} anchor="log" />}
    </div>
  );
}
