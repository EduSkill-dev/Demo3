"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SHARE_NETWORKS, type ShareNetwork } from "@/lib/share";
import { adminAction, adminButton } from "./adminApi";

// One switch per social network: on = clubs get a working button that puts
// their hike's link on that network; off = the button is not shown.
export default function ShareSettings({ enabled }: { enabled: ShareNetwork[] }) {
  const router = useRouter();
  const [on, setOn] = useState<ShareNetwork[]>(enabled);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await adminAction({ action: "share.save", networks: Object.fromEntries(SHARE_NETWORKS.map((n) => [n.id, on.includes(n.id)])) });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="max-w-2xl">
      <h2 className="font-serif text-xl font-semibold text-heading">Սոց. ցանցերում կիսվելը</h2>
      <p className="mt-1 text-sm text-muted">
        Միացված ցանցի կոճակը երևում է ակումբի «Կիսվել» պատուհանում և հայտարարության հղումը տանում է այդ ցանց։ Անջատվածը չի երևում։
        «Պատճենել հղումը» կոճակը միշտ կա։ Կոճակները տեսնում են այն ակումբները, որոնց փաթեթում միացված է «Տարածման կոճակներ»-ը։
      </p>
      <ul className="mt-5 divide-y divide-line rounded-xl border border-line bg-surface">
        {SHARE_NETWORKS.map((n) => (
          <li key={n.id}>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
              <input
                type="checkbox"
                checked={on.includes(n.id)}
                onChange={(e) => {
                  setOn((cur) => (e.target.checked ? [...cur, n.id] : cur.filter((x) => x !== n.id)));
                  setSaved(false);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-spruce-500"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">{n.name}</span>
                <span className="block text-xs text-muted">{n.how}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={busy} className={adminButton}>
          {busy ? "..." : "Պահպանել"}
        </button>
        {saved && <span className="text-sm font-medium text-green-700 dark:text-green-400">Պահպանված է</span>}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
