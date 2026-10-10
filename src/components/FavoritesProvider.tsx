"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// What the signed-in individual follows and likes, loaded once per page (one
// database call) and shared by every bookmark and like button on it.
//   * favourite = follow a club: its new hikes arrive as a notification and
//     an email. Private, anyone signed in as an individual can do it.
//   * like = a public thumbs-up for a hike, or a heart for a club. Only for
//     people who took part (a confirmed booking on a hike that has happened).
// Clubs, admins and visitors get `enabled: false`: they only see the counts.
export type LikeKind = "club" | "tour";

type Engagement = {
  enabled: boolean;
  isFavorite: (clubId: string) => boolean;
  toggleFavorite: (clubId: string) => Promise<void>;
  liked: (kind: LikeKind, id: string) => boolean;
  canLike: (kind: LikeKind, id: string) => boolean;
  toggleLike: (kind: LikeKind, id: string) => Promise<boolean>; // false = refused
};

const none: Engagement = {
  enabled: false,
  isFavorite: () => false,
  toggleFavorite: async () => {},
  liked: () => false,
  canLike: () => false,
  toggleLike: async () => false,
};
const EngagementContext = createContext<Engagement>(none);

type Sets = { favorites: Set<string>; clubLikes: Set<string>; tourLikes: Set<string>; attendedTours: Set<string>; attendedClubs: Set<string> };
const empty = (): Sets => ({ favorites: new Set(), clubLikes: new Set(), tourLikes: new Set(), attendedTours: new Set(), attendedClubs: new Set() });

export function FavoritesProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [sets, setSets] = useState<Sets>(empty);

  useEffect(() => {
    if (!userId) return setSets(empty());
    let alive = true;
    createClient()
      .rpc("my_engagement")
      .then(({ data }) => {
        if (!alive || !data) return;
        const d = data as Record<keyof Sets, string[]>;
        setSets({
          favorites: new Set(d.favorites),
          clubLikes: new Set(d.clubLikes),
          tourLikes: new Set(d.tourLikes),
          attendedTours: new Set(d.attendedTours),
          attendedClubs: new Set(d.attendedClubs),
        });
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const flip = (key: keyof Sets, id: string, on: boolean) =>
    setSets((cur) => {
      const next = new Set(cur[key]);
      if (on) next.add(id);
      else next.delete(id);
      return { ...cur, [key]: next };
    });

  const toggleFavorite = useCallback(
    async (clubId: string) => {
      if (!userId) return;
      const supabase = createClient();
      const on = sets.favorites.has(clubId);
      const { error } = on
        ? await supabase.from("favorite_clubs").delete().eq("user_id", userId).eq("club_id", clubId)
        : await supabase.from("favorite_clubs").insert({ user_id: userId, club_id: clubId });
      if (!error) flip("favorites", clubId, !on);
    },
    [userId, sets.favorites]
  );

  const toggleLike = useCallback(
    async (kind: LikeKind, id: string) => {
      if (!userId) return false;
      const supabase = createClient();
      const table = kind === "club" ? "club_likes" : "tour_likes";
      const column = kind === "club" ? "club_id" : "tour_id";
      const key = kind === "club" ? "clubLikes" : "tourLikes";
      const on = sets[key].has(id);
      const { error } = on
        ? await supabase.from(table).delete().eq("user_id", userId).eq(column, id)
        : await supabase.from(table).insert({ user_id: userId, [column]: id });
      if (error) return false;
      flip(key, id, !on);
      return true;
    },
    [userId, sets]
  );

  const value = useMemo<Engagement>(
    () => ({
      enabled: !!userId,
      isFavorite: (clubId) => sets.favorites.has(clubId),
      toggleFavorite,
      liked: (kind, id) => (kind === "club" ? sets.clubLikes : sets.tourLikes).has(id),
      canLike: (kind, id) => !!userId && (kind === "club" ? sets.attendedClubs : sets.attendedTours).has(id),
      toggleLike,
    }),
    [userId, sets, toggleFavorite, toggleLike]
  );
  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}

export const useEngagement = () => useContext(EngagementContext);
