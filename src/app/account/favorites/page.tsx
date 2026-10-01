"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Row {
  club_id: string;
  clubs: { id: string; name: string; photo_url: string | null } | null;
}

export default function FavoritesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setLoading(false);
    setUserId(auth.user.id);
    const { data } = await supabase
      .from("favorite_clubs")
      .select("club_id, clubs(id, name, photo_url)")
      .eq("user_id", auth.user.id);
    setRows((data ?? []) as any as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(clubId: string) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("favorite_clubs").delete().eq("user_id", userId).eq("club_id", clubId);
    setRows((cur) => cur.filter((r) => r.club_id !== clubId));
  }

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;
  if (rows.length === 0)
    return (
      <p className="text-neutral-500">
        Դեռ սիրված ակումբ չունես։ Ակումբի էջում կարող ես ավելացնել։
      </p>
    );

  return (
    <ul className="space-y-3">
      {rows.map((r) =>
        r.clubs ? (
          <li
            key={r.club_id}
            className="flex items-center justify-between rounded-lg border border-sand bg-white p-4"
          >
            <Link href={`/clubs/${r.clubs.id}`} className="font-semibold text-pine hover:text-apricot-dark">
              {r.clubs.name}
            </Link>
            <button
              onClick={() => remove(r.club_id)}
              title="Հեռացնել սիրվածներից"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 hover:border-red-400 hover:text-red-500"
            >
              −
            </button>
          </li>
        ) : null
      )}
    </ul>
  );
}
