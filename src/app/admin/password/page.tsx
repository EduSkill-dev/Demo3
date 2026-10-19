import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { deviceIdOf, viaOf } from "@/lib/adminSecurity";
import PasswordForm from "@/components/admin/PasswordForm";
import AdminSecurityPanel from "@/components/admin/AdminSecurityPanel";

// A phone shown in part: +374 77 112264 → +3**77**2*4 (first digit, the
// operator code and two of the last ones).
function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 8) return "•••";
  return `+${d[0]}**${d.slice(3, 5)}**${d[d.length - 3]}*${d[d.length - 1]}`;
}

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("hy-AM", { timeZone: "Asia/Yerevan", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
    : null;

// "Admin data": who this admin is (both addresses for the super admin), the
// sign-in protection, and the password of the address this session signed
// in with. The other address's password has its own, stricter way.
export default async function AdminDataPage() {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin/password");
  const db = createAdminClient();
  const [{ data }, { data: keyRows }, { data: deviceRows }, { count: codesLeft }, via] = await Promise.all([
    db.from("admins").select("alt_email, phone").eq("user_id", me.userId).maybeSingle(),
    me.isSuper ? db.from("admin_keys").select("id, label, created_at, last_used_at").eq("user_id", me.userId).order("created_at") : Promise.resolve({ data: [] }),
    me.isSuper
      ? db.from("admin_devices").select("id, label, created_at, last_seen_at").eq("user_id", me.userId).eq("revoked", false).order("last_seen_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    me.isSuper ? db.from("admin_recovery_codes").select("id", { count: "exact", head: true }).eq("user_id", me.userId).is("used_at", null) : Promise.resolve({ count: 0 }),
    me.isSuper ? viaOf(me.userId) : Promise.resolve("main" as const),
  ]);
  const a = data as { alt_email: string | null; phone: string | null } | null;
  type R = { id: string; label: string | null; created_at: string; last_used_at?: string | null; last_seen_at?: string };
  const keys = ((keyRows as R[] | null) ?? []).map((k) => ({ id: k.id, label: k.label, created: when(k.created_at)!, used: when(k.last_used_at ?? null) }));
  const current = deviceIdOf();
  const devices = ((deviceRows as R[] | null) ?? []).map((d) => ({ id: d.id, label: d.label, created: when(d.created_at)!, used: when(d.last_seen_at ?? null), current: d.id === current }));
  const signedWith = via === "alt" && a?.alt_email ? a.alt_email : me.email;
  const other = me.isSuper && a?.alt_email ? (via === "alt" ? me.email : a.alt_email) : null;

  const rows: [string, React.ReactNode][] = [
    ["Դեր", me.isSuper ? "Գլխավոր (սուպեր) ադմին" : "Ադմին"],
    [me.isSuper ? "Էլ. հասցե 1" : "Էլ. հասցե", me.email],
    ...(me.isSuper ? ([["Էլ. հասցե 2", a?.alt_email ?? "Նշված չէ"]] as [string, React.ReactNode][]) : []),
    ...(me.isSuper ? ([["Այս անգամ մուտք եք գործել", signedWith]] as [string, React.ReactNode][]) : []),
    ...(me.isSuper ? ([["Հեռախոս", a?.phone ? `${maskPhone(a.phone)} · SMS-ը՝ շուտով` : "Նշված չէ"]] as [string, React.ReactNode][]) : []),
    [
      "Մուտքի պաշտպանություն",
      me.isSuper
        ? "5 սխալ գաղտնաբառ անընդմեջ՝ տվյալ հասցեով մուտքը փակվում է 30 րոպեով (մյուս հասցեն և մեկանգամյա կոդերը աշխատում են)"
        : "5 սխալ գաղտնաբառ անընդմեջ՝ հաշիվը կողպվում է, բացում է Գլխավոր ադմինը",
    ],
    ...(me.isSuper
      ? ([
          [
            "Նոր սարքից մուտքի հաստատում",
            keys.length ? (
              <span key="2fa" className="text-spruce-700 dark:text-spruce-300">✓ Միացված է · {keys.length} բանալի</span>
            ) : (
              <span key="2fa" className="text-muted">Միացված չէ․ գրանցեք բանալին ներքևում</span>
            ),
          ],
        ] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="font-serif text-xl font-semibold text-heading">Ադմինի տվյալներ</h2>
        <dl className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="text-muted">{k}</dt>
              <dd className="break-words font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3 className="font-serif text-lg font-semibold text-heading">Փոխել գաղտնաբառը</h3>
        {me.isSuper && <p className="mb-4 mt-1 text-sm text-muted">{signedWith} հասցեի գաղտնաբառը (որով հիմա մուտք եք գործել)։</p>}
        <div className={me.isSuper ? "" : "mt-4"}>
          <PasswordForm forced={false} />
        </div>
      </section>
      {me.isSuper && <AdminSecurityPanel keys={keys} devices={devices} codesLeft={codesLeft ?? 0} other={other} />}
    </div>
  );
}
