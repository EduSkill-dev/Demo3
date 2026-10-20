"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import CertifiedIcon from "./CertifiedIcon";

// The blue seal by a certified club's name (hike cards). Hovering or a tap
// shows what it means and a link to the certificate on the club's page.
export default function CertifiedBadge({ clubHref }: { clubHref: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  // Leaving closes it after a moment, so the mouse can cross to the link.
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (closing.current) clearTimeout(closing.current);
    setOpen(true);
  };
  const hideSoon = () => {
    if (closing.current) clearTimeout(closing.current);
    closing.current = setTimeout(() => setOpen(false), 350);
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <span ref={box} className="group relative inline-flex" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        type="button"
        aria-label={t("certificate.badge")}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true); // a tap opens it (hovering already did with a mouse); a tap elsewhere closes it
        }}
        className="inline-flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <CertifiedIcon />
      </button>
      {open && (
        // The padding (not a margin) bridges the step from the seal to the
        // hint, so the mouse can reach the link without closing it.
        <span role="tooltip" className="absolute bottom-full left-1/2 z-30 w-56 -translate-x-1/2 pb-1.5">
          <span className="block rounded-lg border border-line bg-surface p-2.5 text-left text-xs font-normal leading-snug text-ink shadow-lg">
            {t("certificate.badgeHint")}{" "}
            <Link href={`${clubHref}?cert=1`} className="font-semibold text-sky-600 hover:underline dark:text-sky-400">
              {t("certificate.seeOnClubPage")}
            </Link>
          </span>
        </span>
      )}
    </span>
  );
}
