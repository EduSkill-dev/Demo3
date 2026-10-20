"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadImage, removeStored, IMAGE_ACCEPT } from "@/lib/storage";
import { useT } from "@/i18n/client";
import type { Club } from "@/types/database";
import CertifiedIcon from "./CertifiedIcon";

// The club's certificate: upload a picture of the document; an admin checks
// it. The status comes from the server (a new picture always starts the
// check again — the database sees to that).
export default function ClubCertificate({ club }: { club: Club }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = club.certificate_url ?? null;
  const status = club.certificate_status ?? null;

  async function change(file: File | null) {
    setError(null);
    if (!file && !window.confirm(t("certificate.removeConfirm"))) return;
    if (file && status === "approved" && !window.confirm(t("certificate.replaceWarning"))) return;
    setBusy(true);
    let next: string | null = null;
    if (file) {
      const up = await uploadImage("certificates", file);
      if ("error" in up) {
        setBusy(false);
        return setError(t("clubData.uploadFailed", { message: up.error }));
      }
      next = up.url;
    }
    const { error: err } = await createClient().from("clubs").update({ certificate_url: next }).eq("id", club.id);
    setBusy(false);
    if (err) return setError(err.message);
    removeStored(url);
    router.refresh();
  }

  const state =
    status === "approved"
      ? { text: t("certificate.statusApproved"), tone: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300" }
      : status === "pending"
        ? { text: t("certificate.statusPending"), tone: "border-apricot-300 bg-apricot-100/60 text-apricot-700 dark:border-apricot-500/40 dark:bg-apricot-500/10 dark:text-apricot-300" }
        : status === "rejected"
          ? { text: t("certificate.statusRejected", { note: club.certificate_note ?? "" }), tone: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300" }
          : { text: t("certificate.statusNone"), tone: "border-line bg-sand/50 text-muted" };

  return (
    <section>
      <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-heading">
        {status === "approved" && <CertifiedIcon className="h-5 w-5" />}
        {t("certificate.section")}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t("certificate.intro")}</p>
      <p className={`mt-3 inline-block rounded-lg border px-3 py-2 text-sm font-medium ${state.tone}`}>{state.text}</p>
      <div className="mt-3 flex flex-wrap items-start gap-4">
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-line bg-surface p-1">
            <img src={url} alt={t("certificate.section")} className="max-h-48 w-auto max-w-[16rem] rounded object-contain" />
          </a>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-spruce-500">
            {busy ? "..." : url ? t("certificate.replace") : t("certificate.upload")}
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (f) change(f);
              }}
            />
          </label>
          {url && (
            <button type="button" disabled={busy} onClick={() => change(null)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:text-red-600">
              {t("certificate.remove")}
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
