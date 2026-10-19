"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_LIMITS, type AccountLimit, type AccountStatus } from "@/lib/adminLabels";
import { adminAction, adminGhost } from "./adminApi";

// Ask, call /api/admin for this account, refresh the list.
function useAccountAction(userId: string) {
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
  return { busy, error, run };
}

const compact = "!px-2 !py-1";

// Freeze / block / re-activate / delete for one individual or club account.
export default function AccountActions({ userId, status, label }: { userId: string; status: AccountStatus; label: string }) {
  const { busy, error, run } = useAccountAction(userId);
  const setStatus = (next: AccountStatus, question: string) => run({ action: "account.setStatus", status: next }, question);

  return (
    <div>
      <div className="flex justify-end gap-1.5">
        {status !== "active" && (
          <button type="button" disabled={busy} className={`${adminGhost} ${compact}`} onClick={() => setStatus("active", `Ակտիվացնե՞լ «${label}» հաշիվը։`)}>
            Ակտիվացնել
          </button>
        )}
        {status !== "frozen" && (
          <button
            type="button"
            disabled={busy}
            className={`${adminGhost} ${compact}`}
            onClick={() => setStatus("frozen", `Սառեցնե՞լ «${label}» հաշիվը։ Այն կկարողանա մուտք գործել, բայց միայն դիտել։`)}
          >
            Սառեցնել
          </button>
        )}
        {status !== "blocked" && (
          <button
            type="button"
            disabled={busy}
            className={`${adminGhost} ${compact}`}
            onClick={() => setStatus("blocked", `Արգելափակե՞լ «${label}» հաշիվը։ Այն այլևս չի կարողանա մուտք գործել։`)}
          >
            Արգելափակել
          </button>
        )}
        {/* Delete: a red bin, to save room in the row. */}
        <button
          type="button"
          disabled={busy}
          aria-label="Ջնջել հաշիվը"
          title="Ջնջել հաշիվը"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/40"
          onClick={() =>
            run({ action: "account.delete" }, `Ջնջե՞լ «${label}» հաշիվը իր ամբողջ տվյալներով։ Այս գործողությունը հետ բերել հնարավոր չէ։`)
          }
        >
          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.8 10.6a1.5 1.5 0 0 0 1.5 1.4h4.4a1.5 1.5 0 0 0 1.5-1.4l.8-10.6M8.5 9v5M11.5 9v5" />
          </svg>
        </button>
      </div>
      {error && <p className="mt-1 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}

// The single functions that can be forced off, as on/off chips.
export function LimitSwitches({
  userId,
  label,
  limits,
}: {
  userId: string;
  label: string;
  limits: { key: AccountLimit; blocked: boolean }[];
}) {
  const { busy, error, run } = useAccountAction(userId);

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {limits.map((l) => {
          const name = ACCOUNT_LIMITS[l.key].label;
          return (
            <button
              key={l.key}
              type="button"
              disabled={busy}
              aria-pressed={!l.blocked}
              title={`${name}՝ ${l.blocked ? "անջատված" : "միացված"}`}
              onClick={() =>
                run(
                  { action: "account.setLimit", limit: l.key, blocked: !l.blocked },
                  l.blocked ? `Միացնե՞լ «${name}» ֆունկցիան «${label}» հաշվի համար։` : `Անջատե՞լ «${name}» ֆունկցիան «${label}» հաշվի համար։`
                )
              }
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold disabled:opacity-50 ${
                l.blocked
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                  : "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
              }`}
            >
              {l.blocked ? "✕" : "✓"} {ACCOUNT_LIMITS[l.key].short}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
