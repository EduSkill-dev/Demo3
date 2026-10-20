"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import Modal from "@/components/ui/Modal";
import CertifiedIcon from "./CertifiedIcon";

// "Certificate" on a certified club's page: the document as it was uploaded,
// whole (never cropped — a cut-off line could be the one that matters).
// Opened at once when the page is reached from a hike card's badge (?cert=1).
export default function CertificateButton({ url, clubName, initiallyOpen = false }: { url: string; clubName: string; initiallyOpen?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-sm font-semibold text-sky-700 transition hover:border-sky-500 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
      >
        <CertifiedIcon />
        {t("certificate.button")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("certificate.title", { name: clubName })} size="lg">
        <img src={url} alt={t("certificate.title", { name: clubName })} className="mx-auto max-h-[75vh] w-auto max-w-full rounded-lg object-contain" />
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted">
          <CertifiedIcon />
          {t("certificate.checked")}
        </p>
      </Modal>
    </>
  );
}
