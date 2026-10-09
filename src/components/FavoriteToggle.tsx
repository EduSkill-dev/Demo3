"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { useFavorites } from "./FavoritesProvider";

const HEART = "M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 5 6.4 5c2 0 3.6 1.1 4.6 2.6l1 1.4 1-1.4C14 6.1 15.6 5 17.6 5 21 5 23.1 8.5 21.6 11.8 19.5 16.4 12 21 12 21z";

// The heart: an individual adds a club to (or removes it from) their
// favourites, and so follows its new hikes. `compact` is the round icon used
// on tour cards and next to a hike's club; the full button sits on the club
// page. Nothing is rendered for clubs, admins and visitors.
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
  const { enabled, has, toggle } = useFavorites();
  const [busy, setBusy] = useState(false);
  if (!enabled) return null;

  const isFavorite = has(clubId);
  const label = isFavorite ? t("clubPage.inFavorites") : t("clubPage.addFavorite");
  const title = clubName ? `${clubName} · ${label}` : label;
  async function click() {
    setBusy(true);
    await toggle(clubId);
    setBusy(false);
  }
  const icon = (size: string) => (
    <svg viewBox="0 0 24 24" className={size} fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d={HEART} />
    </svg>
  );

  if (compact) {
    return (
      <button
        type="button"
        onClick={click}
        disabled={busy}
        aria-pressed={isFavorite}
        aria-label={title}
        title={title}
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-md transition hover:scale-105 ${
          isFavorite ? "text-terracotta-500" : "text-spruce-900 hover:text-terracotta-500"
        }`}
      >
        {icon("h-5 w-5")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      aria-pressed={isFavorite}
      title={title}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        isFavorite
          ? "border-terracotta-300 bg-terracotta-100 text-terracotta-700"
          : "border-line text-ink hover:border-terracotta-300 hover:text-terracotta-700"
      }`}
    >
      {icon("h-5 w-5")}
      {label}
    </button>
  );
}
