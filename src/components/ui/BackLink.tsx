"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// "← Back": returns to the page the visitor came from on this site; someone
// who opened the link directly goes to `fallback` instead.
export default function BackLink({ fallback, label, className }: { fallback: string; label: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      className={className}
      onClick={(e) => {
        let sameSite = false;
        try {
          sameSite = !!document.referrer && new URL(document.referrer).origin === window.location.origin;
        } catch {
          sameSite = false;
        }
        if (sameSite && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      ← {label}
    </Link>
  );
}
