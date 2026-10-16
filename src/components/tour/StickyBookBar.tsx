"use client";

import { useEffect, useState } from "react";

// Phones: the sign-up box sits after the whole description, so a bar at the
// bottom keeps the price and a button that scrolls to it. It steps aside
// while the box itself is on screen.
export default function StickyBookBar({ price, label, target = "signup" }: { price: string; label: string; target?: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur transition-transform lg:hidden ${
        hidden ? "translate-y-full" : ""
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <span className="font-semibold text-heading">{price}</span>
        <a
          href={`#${target}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="rounded-full bg-spruce-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900"
        >
          {label}
        </a>
      </div>
    </div>
  );
}
