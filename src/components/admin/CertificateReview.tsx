"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import CertifiedIcon from "@/components/club/CertifiedIcon";
import { adminAction, adminButton, adminDanger, adminGhost, adminInput } from "./adminApi";

export type CertificateInfo = { url: string; status: "pending" | "approved" | "rejected"; note: string | null };

// The certificate chip in a club's row: orange while it waits for a check,
// blue once approved, red when rejected. It opens the document whole, with
// approve / reject (a reason the club will read) / take the approval back.
export default function CertificateReview({ userId, label, cert }: { userId: string; label: string; cert: CertificateInfo }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject" | "revoke") {
    setBusy(true);
    setError(null);
    const res = await adminAction({ action: "club.certificate", userId, decision, note });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setOpen(false);
    setNote("");
    router.refresh();
  }

  const chip =
    cert.status === "approved"
      ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
      : cert.status === "pending"
        ? "border-apricot-500 bg-apricot-100 text-apricot-700 dark:bg-apricot-500/20 dark:text-apricot-300"
        : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300";
  const text = cert.status === "approved" ? "Հավաստագիր ✓" : cert.status === "pending" ? "Հավաստագիր՝ ստուգել" : "Հավաստագիր ✕";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${chip}`}>
        {cert.status === "approved" && <CertifiedIcon className="h-3.5 w-3.5" />}
        {text}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Հավաստագիր՝ ${label}`}
        size="lg"
        footer={
          <div className="flex flex-wrap items-end justify-between gap-3 whitespace-normal text-left font-normal">
            <label className="min-w-[14rem] flex-1 text-sm">
              <span className="mb-1 block text-muted">
                {cert.status === "approved" ? "Պատճառ (պարտադիր, ակումբը կտեսնի)" : "Պատճառ (մերժելիս՝ պարտադիր, ակումբը կտեսնի)"}
              </span>
              <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="օր.՝ նկարը ընթեռնելի չէ" className={adminInput} />
            </label>
            <div className="flex flex-wrap gap-2">
              {cert.status === "approved" ? (
                <button type="button" disabled={busy} onClick={() => decide("revoke")} className={`${adminDanger} !py-2 !text-sm`}>
                  Հետ կանչել հաստատումը
                </button>
              ) : (
                <>
                  <button type="button" disabled={busy} onClick={() => decide("reject")} className={`${adminDanger} !py-2 !text-sm`}>
                    Մերժել
                  </button>
                  <button type="button" disabled={busy} onClick={() => decide("approve")} className={adminButton}>
                    {busy ? "..." : "Հաստատել"}
                  </button>
                </>
              )}
              <button type="button" className={`${adminGhost} !py-2 !text-sm`} onClick={() => setOpen(false)}>
                Փակել
              </button>
            </div>
            {error && <p className="w-full text-sm text-red-600">{error}</p>}
          </div>
        }
      >
        <div className="whitespace-normal text-left font-normal">
          {cert.status === "rejected" && cert.note && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">Նախորդ մերժումը՝ {cert.note}</p>}
          <a href={cert.url} target="_blank" rel="noopener noreferrer" title="Բացել նոր ներդիրում">
            <img src={cert.url} alt={`Հավաստագիր՝ ${label}`} className="mx-auto max-h-[65vh] w-auto max-w-full rounded-lg border border-line object-contain" />
          </a>
        </div>
      </Modal>
    </>
  );
}
