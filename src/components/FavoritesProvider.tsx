"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// The signed-in individual's favourite clubs, loaded once per page and shared
// by every heart on it (tour cards, hike details, the club page). A favourite
// club is one the person follows: its new hikes arrive as a notification and
// an email. Clubs, admins and visitors have no favourites, so no hearts.
type Favorites = { enabled: boolean; has: (clubId: string) => boolean; toggle: (clubId: string) => Promise<void> };

const FavoritesContext = createContext<Favorites>({ enabled: false, has: () => false, toggle: async () => {} });

export function FavoritesProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return setIds(new Set());
    let alive = true;
    createClient()
      .from("favorite_clubs")
      .select("club_id")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (alive) setIds(new Set(((data ?? []) as { club_id: string }[]).map((r) => r.club_id)));
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = useCallback(
    async (clubId: string) => {
      if (!userId) return;
      const supabase = createClient();
      const on = ids.has(clubId);
      const { error } = on
        ? await supabase.from("favorite_clubs").delete().eq("user_id", userId).eq("club_id", clubId)
        : await supabase.from("favorite_clubs").insert({ user_id: userId, club_id: clubId });
      if (error) return;
      setIds((cur) => {
        const next = new Set(cur);
        if (on) next.delete(clubId);
        else next.add(clubId);
        return next;
      });
    },
    [userId, ids]
  );

  const value = useMemo(() => ({ enabled: !!userId, has: (clubId: string) => ids.has(clubId), toggle }), [userId, ids, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export const useFavorites = () => useContext(FavoritesContext);
