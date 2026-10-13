"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SHARE_NETWORKS, type ShareNetwork } from "@/lib/share";
import Modal from "@/components/ui/Modal";
import { adminAction, adminButton, adminGhost } from "./adminApi";

// The "Կիսվել n/5" chip in a club's row: opens the social networks one by
// one for this club. A network closed here keeps its button in the club's
// Share window, but the button does not work. Networks the platform has
// switched off (Սոց. ցանցեր) show for nobody, whatever is set here.
export default function ClubShareEditor({
  userId,
  label,
  blocked,
  platform,
}: {
  userId: string;
  label: string;
  blocked: ShareNetwork[]; // closed for this club
  platform: ShareNetwork[]; // switched on for the platform
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState<ShareNetwork[]>(blocked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = SHARE_NETWORKS.length;
  const allowed = total - blocked.length;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await adminAction({ action: "club.setShare", userId, blocked: closed });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        title={`Սոց. ցանցերում կիսվելը՝ բաց է ${allowed}-ը ${total}-ից`}
        onClick={() => {
          setClosed(blocked);
          setError(null);
          setOpen(true);
        }}
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          allowed === total
            ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
            : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
        }`}
      >
        Կիսվել {allowed}/{total}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Կիսվել՝ ${label}`}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 whitespace-normal text-left font-normal">
            <span className="text-sm text-red-600">{error}</span>
            <div className="flex gap-2">
              <button type="button" className={`${adminGhost} !rounded-full !px-4 !py-2 !text-sm`} onClick={() => setOpen(false)}>
                Չեղարկել
              </button>
              <button type="button" disabled={busy} className={adminButton} onClick={save}>
                {busy ? "..." : "Պահպանել"}
              </button>
            </div>
          </div>
        }
      >
        <div className="whitespace-normal text-left font-normal">
          <p className="text-sm text-muted">
            Նշված ցանցերում այս ակումբը կարող է կիսվել իր հայտարարություններով։ Հանված նշումով ցանցի կոճակն ակումբը տեսնում է, բայց այն չի աշխատում։
          </p>
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {SHARE_NETWORKS.map((n) => {
              const off = !platform.includes(n.id);
              return (
                <li key={n.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!closed.includes(n.id)}
                      onChange={(e) => setClosed((cur) => (e.target.checked ? cur.filter((x) => x !== n.id) : [...cur, n.id]))}
                      className="h-4 w-4 shrink-0 accent-spruce-500"
                    />
                    <span className="text-sm font-semibold text-ink">{n.name}</span>
                    {off && <span className="ml-auto rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-muted">հարթակում անջատված է</span>}
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">Հարթակում անջատված ցանցի կոճակը ոչ ոք չի տեսնում՝ անկախ այստեղ նշվածից («Սոց. ցանցեր» բաժին)։</p>
        </div>
      </Modal>
    </>
  );
}
