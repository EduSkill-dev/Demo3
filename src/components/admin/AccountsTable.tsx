import { STATUS_LABELS, type AccountLimit, type AccountStatus } from "@/lib/adminLabels";
import AccountActions, { LimitSwitches } from "./AccountActions";
import SearchBox from "./SearchBox";

export type AccountRow = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: AccountStatus;
  joined: string; // already formatted
  extra?: [string, string?]; // e.g. the club's package and, under it, until when
  limits: { key: AccountLimit; blocked: boolean }[]; // functions an admin can force off
};

const BADGE: Record<AccountStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  frozen: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

const th = "whitespace-nowrap px-2 py-2.5 font-semibold first:pl-3 last:pr-3";
const td = "whitespace-nowrap px-2 py-2 first:pl-3 last:pr-3";

// The individuals list and the clubs list are the same table. Nothing wraps:
// the name sits over the contact details, everything else is one line, and a
// narrow screen scrolls the table sideways.
export default function AccountsTable({
  title,
  nameHeader,
  extraHeader,
  rows,
}: {
  title: string;
  nameHeader: string;
  extraHeader?: string;
  rows: AccountRow[];
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-heading">
          {title} ({rows.length})
        </h2>
        <SearchBox placeholder="Փնտրել ըստ անվան, էլ. հասցեի, հեռախոսի" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className={th}>{nameHeader}</th>
              {extraHeader && <th className={`${th} text-center`}>{extraHeader}</th>}
              <th className={`${th} text-center`}>Գրանցվել է</th>
              <th className={`${th} text-center`}>Կարգավիճակ</th>
              <th className={`${th} text-center`}>Ֆունկցիաներ</th>
              <th className={`${th} text-right`}>Գործողություններ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={extraHeader ? 6 : 5} className="px-4 py-6 text-center text-muted">Հաշիվ չի գտնվել։</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.userId} className="border-b border-line last:border-0">
                <td className={td}>
                  {/* A fixed width, so long names and addresses are cut with "…" (full text on hover). */}
                  <div className="w-[13rem] 2xl:w-[20rem]">
                    <span className="block truncate font-medium text-ink" title={r.name}>{r.name || "—"}</span>
                    <span className="block truncate text-xs text-muted" title={`${r.email}${r.phone ? ` · ${r.phone}` : ""}`}>
                      {r.email}
                      {r.phone ? ` · ${r.phone}` : ""}
                    </span>
                  </div>
                </td>
                {extraHeader && (
                  <td className={`${td} text-center`}>
                    <span className="block font-medium text-ink">{r.extra?.[0] ?? "—"}</span>
                    {r.extra?.[1] && <span className="block text-xs text-muted">{r.extra[1]}</span>}
                  </td>
                )}
                <td className={`${td} text-center text-muted`}>{r.joined}</td>
                <td className={`${td} text-center`}>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                </td>
                <td className={`${td} text-center`}>
                  <LimitSwitches userId={r.userId} label={r.name || r.email} limits={r.limits} />
                </td>
                <td className={td}>
                  <AccountActions userId={r.userId} status={r.status} label={r.name || r.email} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Ֆունկցիաներ՝ կանաչը միացված է, կարմիրը՝ անջատված։ Սեղմեք՝ փոխելու համար։
      </p>
    </div>
  );
}
