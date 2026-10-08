"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";

export type FavoriteRow = { id: string; name: string; photo_url: string | null; attended: number };

// Favourite clubs: name, hikes done with them, and a remove button. The
// system notifies the person about these clubs' new hikes.
export default function FavoritesList({ rows }: { rows: FavoriteRow[] }) {
  const t = useT();
  const router = useRouter();
  const [list, setList] = useState(rows);

  async function remove(id: string) {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("favorite_clubs").delete().eq("user_id", auth.user.id).eq("club_id", id);
    if (!error) {
      setList((cur) => cur.filter((c) => c.id !== id));
      router.refresh();
    }
  }

  if (list.length === 0) {
    return <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("account.favoritesEmpty")}</p>;
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {list.map((c) => (
        <li key={c.id} className="flex items-center gap-4 px-4 py-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-sand">
            {c.photo_url ? <img src={c.photo_url} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center">🏔️</div>}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/clubs/${c.id}`} className="font-semibold text-ink hover:text-terracotta-700">{c.name}</Link>
            <p className="text-xs text-muted">{t("account.toursWithClub", { count: c.attended })}</p>
          </div>
          <button
            type="button"
            onClick={() => remove(c.id)}
            aria-label={t("account.removeFavorite")}
            title={t("account.removeFavorite")}
            className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}
