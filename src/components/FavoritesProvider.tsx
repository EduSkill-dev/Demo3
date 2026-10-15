"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// What the signed-in individual has liked, loaded once per page (one
// database call) and shared by every like button on it:
//   * a thumbs-up for a hike they took part in,
//   * a heart for a place they went to on one of their hikes.
// Only people who took part (a confirmed booking on a hike that has happened,
// not marked absent) may like. Clubs, admins and visitors get
// `enabled: false`: they only see the counts.
export type LikeKind = "tour" | "sight";

type Engagement = {
  enabled: boolean;
  liked: (kind: LikeKind, id: string) => boolean;
  canLike: (kind: LikeKind, id: string) => boolean;
  toggleLike: (kind: LikeKind, id: string) => Promise<boolean>; // false = refused
};

const none: Engagement = {
  enabled: false,
  liked: () => false,
  canLike: () => false,
  toggleLike: async () => false,
};
const EngagementContext = createContext<Engagement>(none);

type Sets = { tourLikes: Set<string>; sightLikes: Set<string>; attendedTours: Set<string>; attendedSights: Set<string> };
const empty = (): Sets => ({ tourLikes: new Set(), sightLikes: new Set(), attendedTours: new Set(), attendedSights: new Set() });

const TABLE: Record<LikeKind, { table: string; column: string; likes: "tourLikes" | "sightLikes"; may: "attendedTours" | "attendedSights" }> = {
  tour: { table: "tour_likes", column: "tour_id", likes: "tourLikes", may: "attendedTours" },
  sight: { table: "sight_likes", column: "sight_id", likes: "sightLikes", may: "attendedSights" },
};

export function FavoritesProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [sets, setSets] = useState<Sets>(empty);

  useEffect(() => {
    if (!userId) return setSets(empty());
    let alive = true;
    createClient()
      .rpc("my_engagement")
      .then(({ data }) => {
        if (!alive || !data) return;
        const d = data as Partial<Record<keyof Sets, string[]>>;
        setSets({
          tourLikes: new Set(d.tourLikes ?? []),
          sightLikes: new Set(d.sightLikes ?? []),
          attendedTours: new Set(d.attendedTours ?? []),
          attendedSights: new Set(d.attendedSights ?? []),
        });
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggleLike = useCallback(
    async (kind: LikeKind, id: string) => {
      if (!userId) return false;
      const { table, column, likes } = TABLE[kind];
      const on = sets[likes].has(id);
      const supabase = createClient();
      const { error } = on
        ? await supabase.from(table).delete().eq("user_id", userId).eq(column, id)
        : await supabase.from(table).insert({ user_id: userId, [column]: id });
      if (error) return false;
      setSets((cur) => {
        const next = new Set(cur[likes]);
        if (on) next.delete(id);
        else next.add(id);
        return { ...cur, [likes]: next };
      });
      return true;
    },
    [userId, sets]
  );

  const value = useMemo<Engagement>(
    () => ({
      enabled: !!userId,
      liked: (kind, id) => sets[TABLE[kind].likes].has(id),
      canLike: (kind, id) => !!userId && sets[TABLE[kind].may].has(id),
      toggleLike,
    }),
    [userId, sets, toggleLike]
  );
  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}

export const useEngagement = () => useContext(EngagementContext);
