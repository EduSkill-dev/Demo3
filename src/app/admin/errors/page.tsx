import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdmin } from "@/lib/admin";
import { ERROR_AREAS } from "@/lib/errors";

type Row = { id: number; at: string; source: "server" | "browser" | "monitor"; area: string; message: string; url: string | null; signature: string };

const SOURCE: Record<Row["source"], [string, string]> = {
  server: ["Սերվեր", "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"],
  browser: ["Բրաուզեր", "bg-apricot-100 text-apricot-700"],
  monitor: ["Հսկիչ", "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"],
};

const stamp = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Yerevan", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

const th = "whitespace-nowrap px-3 py-2.5 font-semibold";
const td = "px-3 py-2 align-top";

// Faults the site caught, newest first. Every admin sees this page: whoever
// notices first can act. The same fault repeated is shown once with a count.
export default async function AdminErrorsPage() {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin/errors");

  const db = createAdminClient();
  const [{ data }, { data: watch }, { data: lastCheck }] = await Promise.all([
    db.from("error_log").select("id, at, source, area, message, url, signature").order("at", { ascending: false }).limit(400),
    db.from("site_settings").select("value").eq("key", "site_watch").maybeSingle(),
    db.from("site_checks").select("at, ok, status").not("ok", "is", null).order("id", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Newest occurrence of each fault, with how many times it happened.
  const groups = new Map<string, Row & { times: number }>();
  for (const r of (data ?? []) as Row[]) {
    const g = groups.get(r.signature);
    if (g) g.times++;
    else groups.set(r.signature, { ...r, times: 1 });
  }
  const rows = [...groups.values()];
  const down = (watch as { value?: { down?: boolean } } | null)?.value?.down === true;
  const check = lastCheck as { at: string; ok: boolean; status: number | null } | null;

  return (
    <div>
      <h2 className="font-serif text-xl font-semibold text-heading">Սխալներ ({rows.length})</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Այն, ինչ կայքում չստացվեց․ սերվերի սխալները, այցելուի բրաուզերում կոտրված էջերը և կայքի անհասանելիությունը։ Յուրաքանչյուր նոր սխալի մասին
        բոլոր ադմինները նամակ են ստանում (նույն սխալի համար՝ ժամը մեկ անգամից ոչ հաճախ)։
      </p>
      <p className={`mt-4 inline-flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
        down ? "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200" : "border-line bg-surface text-ink"
      }`}>
        <span className={`h-2.5 w-2.5 rounded-full ${down ? "bg-red-600" : check ? "bg-green-600" : "bg-sand"}`} aria-hidden="true" />
        {down ? "Հսկիչ՝ կայքը չի պատասխանում" : check ? "Հսկիչ՝ կայքն աշխատում է" : "Հսկիչ՝ դեռ ստուգում չի եղել"}
        {check && <span className="font-normal text-muted">· վերջին ստուգումը՝ {stamp.format(new Date(check.at))}</span>}
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className={th}>Վերջին անգամ</th>
              <th className={`${th} text-center`}>Աղբյուր</th>
              <th className={th}>Բաժին</th>
              <th className={th}>Սխալ</th>
              <th className={`${th} text-center`}>Քանի անգամ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">Սխալ չի գրանցվել։</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className={`${td} whitespace-nowrap text-muted`}>{stamp.format(new Date(r.at))}</td>
                <td className={`${td} whitespace-nowrap text-center`}>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SOURCE[r.source][1]}`}>{SOURCE[r.source][0]}</span>
                </td>
                <td className={`${td} whitespace-nowrap text-ink`}>{ERROR_AREAS[r.area] ?? r.area}</td>
                <td className={td}>
                  <span className="block max-w-[34rem] break-words text-ink">{r.message}</span>
                  {r.url && <span className="block max-w-[34rem] truncate text-xs text-muted">{r.url}</span>}
                </td>
                <td className={`${td} text-center text-muted`}>{r.times}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Ցուցադրվում են վերջին 400 գրառումները․ 90 օրից հինները ջնջվում են։</p>
    </div>
  );
}
