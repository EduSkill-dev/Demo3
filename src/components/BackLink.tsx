"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// "Back" that respects where the visitor came from (browser history) and only
// falls back to the given route when there is no history to go back to.
export default function BackLink({
  fallback = "/tours",
  label = "Վերադառնալ",
}: {
  fallback?: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <Link
      href={fallback}
      onClick={(e) => {
        e.preventDefault();
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-600 hover:text-apricot"
    >
      ← {label}
    </Link>
  );
}
