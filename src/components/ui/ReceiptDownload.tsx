"use client";

import { useT } from "@/i18n/client";

// Opens the printable receipt; the browser's print dialog saves it as a PDF.
export default function ReceiptDownload({ paymentId }: { paymentId: string }) {
  const t = useT();
  return (
    <a
      href={`/receipts/${paymentId}?print=1`}
      target="_blank"
      rel="noopener"
      className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-apricot"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </svg>
      {t("receipt.download")}
    </a>
  );
}
