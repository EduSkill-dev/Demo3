"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FavoriteToggle({ clubId }: { clubId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);
      setUserId(auth.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();
      setRole(profile?.role ?? null);
      const { data: fav } = await supabase
        .from("favorite_clubs")
        .select("club_id")
        .eq("user_id", auth.user.id)
        .eq("club_id", clubId)
        .maybeSingle();
      setIsFavorite(!!fav);
      setLoading(false);
    })();
  }, [clubId]);

  async function toggle() {
    if (!userId) return;
    const supabase = createClient();
    if (isFavorite) {
      await supabase.from("favorite_clubs").delete().eq("user_id", userId).eq("club_id", clubId);
    } else {
      await supabase.from("favorite_clubs").insert({ user_id: userId, club_id: clubId });
    }
    setIsFavorite(!isFavorite);
  }

  if (loading || role !== "individual") return null;

  return (
    <button
      onClick={toggle}
      className={`mt-3 rounded-lg border px-4 py-2 text-sm font-semibold ${
        isFavorite ? "border-apricot bg-apricot/10 text-apricot-dark" : "border-neutral-300 text-neutral-700"
      }`}
    >
      {isFavorite ? "★ Սիրվածների մեջ է" : "☆ Ավելացնել սիրվածների մեջ"}
    </button>
  );
}
