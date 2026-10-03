"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// "Back". With `href` it goes exactly there (e.g. the Tours page with the
// visitor's filters); otherwise it follows browser history and falls back
// to `fallback` when there is none.
export default function BackLink({
  href,
  fallback = "/tours",
  label,
}: {
  href?: string | null;
  fallback?: string;
  label: string;
}) {
  const router = useRouter();
  const className = "inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-apricot-dark";

  if (href) {
    return (
      <Link href={href} className={className}>
        ← {label}
      </Link>
    );
  }
  return (
    <Link
      href={fallback}
      onClick={(e) => {
        e.preventDefault();
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className={className}
    >
      ← {label}
    </Link>
  );
}
