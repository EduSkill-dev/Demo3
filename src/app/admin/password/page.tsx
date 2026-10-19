import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import PasswordForm from "@/components/admin/PasswordForm";

// A phone shown in part: +374 77 112264 → +3**77**2*4 (first digit, the
// operator code and two of the last ones).
function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 8) return "•••";
  return `+${d[0]}**${d.slice(3, 5)}**${d[d.length - 3]}*${d[d.length - 1]}`;
}

// "Admin data": who this admin is (both addresses for the super admin), the
// sign-in safety in place, and the password.
export default async function AdminDataPage() {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin/password");
  const { data } = await createAdminClient().from("admins").select("alt_email, phone, created_at").eq("user_id", me.userId).maybeSingle();
  const a = data as { alt_email: string | null; phone: string | null; created_at: string } | null;

  const rows: [string, React.ReactNode][] = [
    ["Դեր", me.isSuper ? "Գլխավոր (սուպեր) ադմին" : "Ադմին"],
    [me.isSuper ? "Էլ. հասցե 1" : "Էլ. հասցե", me.email],
    ...(me.isSuper ? ([["Էլ. հասցե 2", a?.alt_email ?? "Նշված չէ"]] as [string, React.ReactNode][]) : []),
    ...(me.isSuper ? ([["Հեռախոս", a?.phone ? maskPhone(a.phone) : "Նշված չէ"]] as [string, React.ReactNode][]) : []),
    [
      "Մուտքի պաշտպանություն",
      me.isSuper
        ? "5 սխալ գաղտնաբառ անընդմեջ՝ տվյալ հասցեով մուտքը փակվում է 30 րոպեով (մյուս հասցեն աշխատում է)"
        : "5 սխալ գաղտնաբառ անընդմեջ՝ հաշիվը կողպվում է, բացում է Գլխավոր ադմինը",
    ],
    ...(me.isSuper
      ? ([["Նոր սարքից մուտքի կրկնակի հաստատում", <span key="2fa" className="text-muted">Դեռ միացված չէ (YubiKey / հեռախոս՝ մշակման մեջ)</span>]] as [string, React.ReactNode][])
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
        <h3 className="mb-4 font-serif text-lg font-semibold text-heading">Փոխել գաղտնաբառը</h3>
        <PasswordForm forced={false} />
      </section>
    </div>
  );
}
