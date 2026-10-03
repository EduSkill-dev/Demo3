"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";

// The heart on a club's page: individuals add or remove the club from their
// favourites (and so from new-hike notifications).
export default function FavoriteToggle({ clubId }: { clubId: string }) {
  const t = useT();
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id);
      const [{ data: profile }, { data: fav }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).single(),
        supabase.from("favorite_clubs").select("club_id").eq("user_id", auth.user.id).eq("club_id", clubId).maybeSingle(),
      ]);
      setRole((profile as { role?: string } | null)?.role ?? null);
      setIsFavorite(!!fav);
    })();
  }, [clubId]);

  async function toggle() {
    if (!userId) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = isFavorite
      ? await supabase.from("favorite_clubs").delete().eq("user_id", userId).eq("club_id", clubId)
      : await supabase.from("favorite_clubs").insert({ user_id: userId, club_id: clubId });
    setBusy(false);
    if (!error) setIsFavorite(!isFavorite);
  }

  if (role !== "individual") return null;
  const label = isFavorite ? t("clubPage.inFavorites") : t("clubPage.addFavorite");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={isFavorite}
      title={label}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        isFavorite ? "border-red-300 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40" : "border-line text-ink hover:border-red-300 hover:text-red-600"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 5 6.4 5c2 0 3.6 1.1 4.6 2.6l1 1.4 1-1.4C14 6.1 15.6 5 17.6 5 21 5 23.1 8.5 21.6 11.8 19.5 16.4 12 21 12 21z" />
      </svg>
      {label}
    </button>
  );
}
