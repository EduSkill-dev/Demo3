import type { Badge, BadgeKind } from "@/lib/badges";
import type { TFunction as T } from "@/i18n/translate";

// Each badge: a round medal in its own colour with an icon and the step.
const LOOK: Record<BadgeKind, { bg: string; fg: string; icon: string }> = {
  mountains: { bg: "#1E5B4F", fg: "#FFFDF8", icon: "M3 19l6-10 4 6 2-3 6 7H3z" },
  lakes: { bg: "#2F7A8C", fg: "#FFFDF8", icon: "M3 14c2 0 2-1.5 4.5-1.5S10 14 12 14s2-1.5 4.5-1.5S19 14 21 14M3 18c2 0 2-1.5 4.5-1.5S10 18 12 18s2-1.5 4.5-1.5S19 18 21 18M8 9a4 4 0 0 1 8 0" },
  heritage: { bg: "#C9491F", fg: "#FFFDF8", icon: "M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6H3z" },
  curious: { bg: "#F2B134", fg: "#12332D", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm3.5 5.5l-2 5-5 2 2-5 5-2z" },
};

export function BadgeIcon({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" }) {
  const look = LOOK[badge.kind];
  const box = size === "sm" ? "h-11 w-11" : "h-16 w-16";
  return (
    <span
      className={`relative flex ${box} shrink-0 flex-col items-center justify-center rounded-full shadow-sm ring-2 ring-white/70 dark:ring-black/30`}
      style={{ background: look.bg, color: look.fg }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className={size === "sm" ? "h-4 w-4" : "h-6 w-6"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={look.icon} />
      </svg>
      {badge.label && <span className={`font-bold leading-none ${size === "sm" ? "text-[10px]" : "mt-0.5 text-xs"}`}>{badge.label}</span>}
    </span>
  );
}

export const badgeName = (b: Badge, t: T) => t(`badge.${b.kind}`, { label: b.label });
export const badgeText = (b: Badge, t: T) => t(`badge.${b.kind}Text`, { count: b.count });

// A medal with its name and what it was given for (the passport).
export default function BadgeMedal({ badge, t }: { badge: Badge; t: T }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <BadgeIcon badge={badge} />
      <div className="min-w-0">
        <p className="font-bold text-heading">{badgeName(badge, t)}</p>
        <p className="text-sm text-muted">{badgeText(badge, t)}</p>
      </div>
    </div>
  );
}
