"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/i18n/client";

// Accessible dialog: closes on Escape and backdrop click, locks page scroll,
// and returns focus to whatever opened it.
export default function Modal({
  open,
  onClose,
  title,
  actions,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  actions?: React.ReactNode; // extra buttons next to the close X (e.g. Download)
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-surface text-ink shadow-xl outline-none sm:rounded-2xl ${
          size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="truncate font-serif text-lg font-semibold text-heading">{title}</h2>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="rounded-lg p-1.5 text-muted hover:bg-sand hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
