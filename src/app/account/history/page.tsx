"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Row {
  id: string;
  tours: { id: string; title: string; date: string; clubs: { name: string } | null } | null;
}

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);
      const { data } = await supabase
        .from("bookings")
        .select("id, tours(id, title, date, clubs(name))")
        .eq("user_id", auth.user.id)
        .eq("status", "confirmed");
      const today = new Date().toISOString().slice(0, 10);
      const past = ((data ?? []) as any as Row[])
        .filter((r) => r.tours && r.tours.date < today)
        .sort((a, b) => (a.tours!.date > b.tours!.date ? -1 : 1));
      setRows(past);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;
  if (rows.length === 0)
    return <p className="text-neutral-500">Դեռ մասնակցած արշավի պատմություն չկա։</p>;

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-sand bg-white p-4">
          <p className="font-semibold text-pine">{r.tours?.title}</p>
          <p className="text-sm text-neutral-500">
            {r.tours?.date} · {r.tours?.clubs?.name}
          </p>
        </li>
      ))}
    </ul>
  );
}
