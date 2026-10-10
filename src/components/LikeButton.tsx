"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { useEngagement, type LikeKind } from "./FavoritesProvider";

const HEART = "M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 5 6.4 5c2 0 3.6 1.1 4.6 2.6l1 1.4 1-1.4C14 6.1 15.6 5 17.6 5 21 5 23.1 8.5 21.6 11.8 19.5 16.4 12 21 12 21z";
const THUMB = "M7 21H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3m0 10V11m0 10h9.3a2 2 0 0 0 2-1.6l1.2-6A2 2 0 0 0 17.5 10H14V5.5A2.5 2.5 0 0 0 11.5 3L7 11";

// A public like with its count: a heart for a club, a thumbs-up for a hike.
// Everyone sees the number. Someone who took part (see FavoritesProvider)
// gets a button; anyone else gets the same icon as plain text.
export default function LikeButton({
  kind,
  id,
  count,
  size = "sm",
}: {
  kind: LikeKind;
  id: string;
  count: number; // as the server counted it when the page was rendered
  size?: "sm" | "md";
}) {
  const t = useT();
  const { liked, canLike, toggleLike } = useEngagement();
  const [busy, setBusy] = useState(false);
  // What this person changed since the page was rendered; fresh server data
  // already contains it.
  const [delta, setDelta] = useState(0);
  useEffect(() => setDelta(0), [count]);

  const on = liked(kind, id);
  const shown = Math.max(0, count + delta);
  const allowed = canLike(kind, id) || on;
  const label = kind === "club" ? t("like.club") : t("like.tour");
  const icon = (
    <svg
      viewBox="0 0 24 24"
      className={size === "md" ? "h-5 w-5" : "h-4 w-4"}
      fill={on ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={kind === "club" ? HEART : THUMB} />
    </svg>
  );
  const text = size === "md" ? "text-sm" : "text-xs";
  const tone = kind === "club" ? "text-terracotta-500" : "text-spruce-500 dark:text-spruce-300";

  if (!allowed) {
    return (
      <span
        data-like={kind}
        title={`${label}: ${shown} · ${t("like.onlyParticipants")}`}
        className={`inline-flex items-center gap-1 font-semibold ${text} ${shown > 0 ? tone : "text-muted"}`}
      >
        {icon}
        {shown}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-like={kind}
      disabled={busy}
      aria-pressed={on}
      title={label}
      aria-label={`${label} (${shown})`}
      onClick={async () => {
        setBusy(true);
        if (await toggleLike(kind, id)) setDelta((d) => d + (on ? -1 : 1));
        setBusy(false);
      }}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold transition ${text} ${
        on ? `border-current ${tone}` : `border-line text-ink hover:border-current ${kind === "club" ? "hover:text-terracotta-500" : "hover:text-spruce-500"}`
      }`}
    >
      {icon}
      {shown}
    </button>
  );
}
