import { STATUS_LABELS, type AccountLimit, type AccountStatus } from "@/lib/adminLabels";
import AccountActions from "./AccountActions";
import SearchBox from "./SearchBox";

export type AccountRow = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: AccountStatus;
  joined: string; // already formatted
  extra?: string; // e.g. the club's package
  limits: { key: AccountLimit; blocked: boolean }[]; // functions an admin can force off
};

const BADGE: Record<AccountStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  frozen: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

// The individuals list and the clubs list are the same table.
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
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">{nameHeader}</th>
              <th className="px-4 py-3">Կապ</th>
              {extraHeader && <th className="px-4 py-3">{extraHeader}</th>}
              <th className="px-4 py-3">Գրանցվել է</th>
              <th className="px-4 py-3">Կարգավիճակ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={extraHeader ? 6 : 5} className="px-4 py-6 text-center text-muted">Հաշիվ չի գտնվել։</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.userId} className="border-b border-line align-top last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{r.name || "—"}</td>
                <td className="px-4 py-3 text-muted">
                  <span className="block break-all">{r.email}</span>
                  {r.phone && <span className="block">{r.phone}</span>}
                </td>
                {extraHeader && <td className="px-4 py-3 text-muted">{r.extra ?? "—"}</td>}
                <td className="whitespace-nowrap px-4 py-3 text-muted">{r.joined}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                </td>
                <td className="px-4 py-3">
                  <AccountActions userId={r.userId} status={r.status} label={r.name || r.email} limits={r.limits} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
