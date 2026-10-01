"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Row {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  tours: { title: string } | null;
  clubs: { name: string } | null;
}

export default function MyCommentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);
      const { data } = await supabase
        .from("ratings")
        .select("id, score, comment, created_at, tours(title), clubs(name)")
        .eq("user_id", auth.user.id)
        .not("comment", "is", null)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as any as Row[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;
  if (rows.length === 0) return <p className="text-neutral-500">Դեռ մեկնաբանություն չես թողել։</p>;

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-sand bg-white p-4">
          <p className="text-sm font-semibold text-apricot">
            ★ {r.score} · {r.tours?.title ?? r.clubs?.name}
          </p>
          <p className="mt-1 text-neutral-600">{r.comment}</p>
          <p className="mt-1 text-xs text-neutral-400">{r.created_at?.slice(0, 10)}</p>
        </li>
      ))}
    </ul>
  );
}
