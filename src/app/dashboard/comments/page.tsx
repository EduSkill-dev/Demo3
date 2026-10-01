"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Tariff } from "@/types/database";

interface CommentRow {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  tour_id: string | null;
  club_id: string | null;
  tours: { title: string } | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
}

function authorOf(row: CommentRow) {
  const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
  return name || "Անանուն մասնակից";
}

export default function CommentsPage() {
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);

      const { data: club } = await supabase
        .from("clubs")
        .select("id, tariff")
        .eq("owner_id", auth.user.id)
        .single();
      if (!club) return setLoading(false);
      setTariff(club.tariff as Tariff);

      if (club.tariff !== "start") {
        const { data: tourRows } = await supabase
          .from("tours")
          .select("id")
          .eq("club_id", club.id);
        const ids = (tourRows ?? []).map((t: any) => t.id) as string[];

        let query = supabase
          .from("ratings")
          .select(
            "id, score, comment, created_at, tour_id, club_id, tours(title), profiles(first_name, last_name)"
          )
          .order("created_at", { ascending: false });

        query =
          ids.length > 0
            ? query.or(`tour_id.in.(${ids.join(",")}),club_id.eq.${club.id}`)
            : query.eq("club_id", club.id);

        const { data } = await query;
        setRows((data ?? []) as unknown as CommentRow[]);
      }

      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;

  if (tariff === "start") {
    return (
      <div className="max-w-xl rounded-2xl border border-apricot/40 bg-apricot/10 p-5">
        <h2 className="font-semibold text-apricot-dark">Մեկնաբանությունները անհասանելի են START տարիֆով</h2>
        <p className="mt-2 text-sm text-neutral-700">
          START տարիֆում տեսնում ես միայն հայտար մասնակիցներին։ Ակումբի գնահատականներն ու
          մեկնաբանությունները ցուցադրվում են միայն Advanced տարիֆում։
        </p>
        <Link
          href="/dashboard/tariff"
          className="mt-4 inline-block rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark"
        >
          Փոխել տարիֆը
        </Link>
      </div>
    );
  }

  const withComments = rows.filter((r) => r.comment);
  const avg =
    rows.length > 0 ? rows.reduce((a, r) => a + r.score, 0) / rows.length : null;

  return (
    <div>
      <p className="text-sm text-neutral-500">
        {avg != null
          ? `Միջին գնահատական՝ ★ ${avg.toFixed(1)} (${rows.length} գնահատական)`
          : "Դեռ գնահատական չկա։"}
      </p>

      {withComments.length === 0 ? (
        <p className="mt-6 text-neutral-500">
          Մեկնաբանությունները կհայտնվեն, երբ մասնակիցները գնահատեն քո արշավները։
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {withComments.map((r) => (
            <li key={r.id} className="rounded-xl border border-sand bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-apricot">★ {r.score}</span>
                <span className="text-xs text-neutral-400">{r.created_at.slice(0, 10)}</span>
              </div>
              <p className="mt-2 text-neutral-700">{r.comment}</p>
              <p className="mt-2 text-xs text-neutral-500">
                {authorOf(r)} · {r.tours?.title ?? "Ակումբի մասին"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
