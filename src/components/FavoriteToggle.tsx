"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { useEngagement } from "./FavoritesProvider";

// The bookmark: an individual adds a club to (or removes it from) their
// favourites, and so follows its new hikes. Only individuals see it.
// `compact` is the round icon used on cards and next to a hike's club; the
// full button sits on the club page.
export default function FavoriteToggle({
  clubId,
  clubName,
  compact = false,
}: {
  clubId: string;
  clubName?: string;
  compact?: boolean;
}) {
  const t = useT();
  const { enabled, isFavorite, toggleFavorite } = useEngagement();
  const [busy, setBusy] = useState(false);
  if (!enabled) return null;

  const on = isFavorite(clubId);
  const label = on ? t("clubPage.inFavorites") : t("clubPage.addFavorite");
  const title = clubName ? `${clubName} · ${label}` : label;
  async function click() {
    setBusy(true);
    await toggleFavorite(clubId);
    setBusy(false);
  }
  const icon = (size: string) => (
    <svg viewBox="0 0 24 24" className={size} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
    </svg>
  );

  if (compact) {
    return (
      <button
        type="button"
        data-bookmark
        onClick={click}
        disabled={busy}
        aria-pressed={on}
        aria-label={title}
        title={title}
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-md transition hover:scale-105 ${
          on ? "text-spruce-500" : "text-spruce-900 hover:text-spruce-500"
        }`}
      >
        {icon("h-5 w-5")}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-bookmark
      onClick={click}
      disabled={busy}
      aria-pressed={on}
      title={title}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        on ? "border-spruce-500 bg-spruce-100 text-spruce-700" : "border-line text-ink hover:border-spruce-500"
      }`}
    >
      {icon("h-5 w-5")}
      {label}
    </button>
  );
}
