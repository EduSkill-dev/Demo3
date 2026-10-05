"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_LIMITS, type AccountLimit, type AccountStatus } from "@/lib/adminLabels";
import { adminAction, adminDanger, adminGhost } from "./adminApi";

// Freeze / block / re-activate / delete for one individual or club account,
// plus the single functions that can be forced off.
export default function AccountActions({
  userId,
  status,
  label,
  limits,
}: {
  userId: string;
  status: AccountStatus;
  label: string;
  limits: { key: AccountLimit; blocked: boolean }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: { action: string } & Record<string, unknown>, question: string) {
    if (!confirm(question)) return;
    setBusy(true);
    setError(null);
    const res = await adminAction({ ...body, userId });
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }
  const setStatus = (next: AccountStatus, question: string) => run({ action: "account.setStatus", status: next }, question);

  return (
    <div>
      <div className="flex flex-wrap justify-end gap-1.5">
        {status !== "active" && (
          <button type="button" disabled={busy} className={adminGhost} onClick={() => setStatus("active", `Ակտիվացնե՞լ «${label}» հաշիվը։`)}>
            Ակտիվացնել
          </button>
        )}
        {status !== "frozen" && (
          <button
            type="button"
            disabled={busy}
            className={adminGhost}
            onClick={() => setStatus("frozen", `Սառեցնե՞լ «${label}» հաշիվը։ Այն կկարողանա մուտք գործել, բայց միայն դիտել։`)}
          >
            Սառեցնել
          </button>
        )}
        {status !== "blocked" && (
          <button
            type="button"
            disabled={busy}
            className={adminGhost}
            onClick={() => setStatus("blocked", `Արգելափակե՞լ «${label}» հաշիվը։ Այն այլևս չի կարողանա մուտք գործել։`)}
          >
            Արգելափակել
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          className={adminDanger}
          onClick={() =>
            run({ action: "account.delete" }, `Ջնջե՞լ «${label}» հաշիվը իր ամբողջ տվյալներով։ Այս գործողությունը հետ բերել հնարավոր չէ։`)
          }
        >
          Ջնջել
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {limits.map((l) => (
          <li key={l.key} className="flex items-center justify-end gap-2 text-xs">
            <span className={l.blocked ? "font-semibold text-red-700 dark:text-red-300" : "text-muted"}>
              {ACCOUNT_LIMITS[l.key].label}՝ {l.blocked ? "անջատված" : "միացված"}
            </span>
            <button
              type="button"
              disabled={busy}
              className={adminGhost}
              onClick={() =>
                run(
                  { action: "account.setLimit", limit: l.key, blocked: !l.blocked },
                  l.blocked
                    ? `Միացնե՞լ «${ACCOUNT_LIMITS[l.key].label}» ֆունկցիան «${label}» հաշվի համար։`
                    : `Անջատե՞լ «${ACCOUNT_LIMITS[l.key].label}» ֆունկցիան «${label}» հաշվի համար։`
                )
              }
            >
              {l.blocked ? "Միացնել" : "Անջատել"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
