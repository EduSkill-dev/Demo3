import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdmin } from "@/lib/admin";
import UnblockButton from "@/components/admin/UnblockButton";

type Block = { kind: string; key: string; until: string; reason: string | null; created_at: string };

const FORMS: Record<string, string> = { newsletter: "Բաժանորդագրության ձև", contact: "Առաջարկների ձև", register: "Գրանցում" };
const stamp = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yerevan", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const th = "whitespace-nowrap px-3 py-2.5 font-semibold";
const td = "whitespace-nowrap px-3 py-2";

// What the automatic protection has closed right now, and a way to open it
// early. An address is blocked for an hour after flooding a public form;
// a whole form pauses for half an hour when it is flooded from many
// addresses at once. Both end by themselves.
export default async function AdminSecurityPage() {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin/security");

  const { data } = await createAdminClient().from("security_blocks").select("kind, key, until, reason, created_at").order("created_at", { ascending: false }).limit(200);
  const all = (data ?? []) as Block[];
  const now = Date.now();
  const active = all.filter((b) => new Date(b.until).getTime() > now);
  const past = all.filter((b) => new Date(b.until).getTime() <= now).slice(0, 30);

  const what = (b: Block) => (b.kind === "ip" ? `IP հասցե ${b.key}` : `${FORMS[b.key] ?? b.key} (ամբողջ ձևը)`);
  const table = (rows: Block[], live: boolean) => (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
          <tr>
            <th className={th}>Ինչն է փակվել</th>
            <th className={th}>Պատճառը</th>
            <th className={`${th} text-center`}>Սկիզբ</th>
            <th className={`${th} text-center`}>{live ? "Կբացվի" : "Բացվել է"}</th>
            {live && <th className={th} />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={live ? 5 : 4} className="px-4 py-6 text-center text-muted">{live ? "Այս պահին ոչինչ փակված չէ։" : "Գրառում չկա։"}</td>
            </tr>
          )}
          {rows.map((b) => (
            <tr key={`${b.kind}:${b.key}:${b.created_at}`} className="border-b border-line last:border-0">
              <td className={`${td} font-medium text-ink`}>{what(b)}</td>
              <td className={`${td} text-muted`}>{b.kind === "ip" ? `շատ հարցումներ՝ ${FORMS[b.reason ?? ""] ?? b.reason ?? "—"}` : "հարցումների հեղեղ շատ հասցեներից"}</td>
              <td className={`${td} text-center text-muted`}>{stamp.format(new Date(b.created_at))}</td>
              <td className={`${td} text-center text-muted`}>{stamp.format(new Date(b.until))}</td>
              {live && (
                <td className={`${td} text-right`}>
                  <UnblockButton kind={b.kind} blockKey={b.key} label={what(b)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl font-semibold text-heading">Պաշտպանություն</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Հարթակն ինքն է փակում չարաշահումը․ մեկ հասցեից բաց ձևերի (բաժանորդագրություն, առաջարկներ, գրանցում) չափից շատ հարցումների դեպքում այդ
          հասցեն արգելափակվում է 1 ժամով, իսկ շատ հասցեներից եկող հեղեղի դեպքում ամբողջ ձևը դադարեցվում է 30 րոպեով։ Երկուսն էլ բացվում են ինքնիրեն․
          այստեղից կարելի է բացել ավելի շուտ, եթե փակվել է սխալմամբ։
        </p>
      </div>
      <section>
        <h3 className="mb-2 font-serif text-lg font-semibold text-heading">Հիմա փակված է ({active.length})</h3>
        {table(active, true)}
      </section>
      <section>
        <h3 className="mb-2 font-serif text-lg font-semibold text-heading">Վերջին դեպքերը</h3>
        {table(past, false)}
      </section>
    </div>
  );
}
