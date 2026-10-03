"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CANCEL_WINDOW_HOURS, canCancelBooking } from "@/lib/catalog";

interface Row {
  id: string;
  tours: { id: string; title: string; date: string; meeting_time: string | null; clubs: { name: string } | null } | null;
}

export default function UpcomingToursPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);
      const { data } = await supabase
        .from("bookings")
        .select("id, tours(id, title, date, meeting_time, clubs(name))")
        .eq("user_id", auth.user.id)
        .eq("status", "confirmed");
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = ((data ?? []) as any as Row[])
        .filter((r) => r.tours && r.tours.date >= today)
        .sort((a, b) => (a.tours!.date < b.tours!.date ? -1 : 1));
      setRows(upcoming);
      setLoading(false);
    })();
  }, []);

  async function cancel(bookingId: string) {
    if (!confirm("Չեղարկե՞լ գրանցումդ այս արշավին։")) return;
    setBusyId(bookingId);
    // Through the API: the server writes the change and sends the email.
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", booking_id: bookingId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusyId(null);
    if (!res.ok) {
      alert(data.error || "Չստացվեց չեղարկել, փորձիր նորից։");
      return;
    }
    setRows((cur) => cur.filter((r) => r.id !== bookingId));
  }

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;
  if (rows.length === 0)
    return (
      <p className="text-neutral-500">
        Դեռ արշավի գրանցված չես։ Այցելիր{" "}
        <a href="/tours" className="font-semibold text-apricot">
          Արշավներ
        </a>{" "}
        էջ։
      </p>
    );

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sand bg-white p-4"
        >
          <div>
            <p className="font-semibold text-pine">{r.tours?.title}</p>
            <p className="text-sm text-neutral-500">
              {r.tours?.date} · {r.tours?.clubs?.name}
            </p>
          </div>
          <button
            onClick={() => cancel(r.id)}
            disabled={busyId === r.id || !canCancelBooking(r.tours!.date, r.tours!.meeting_time)}
            title={
              canCancelBooking(r.tours!.date, r.tours!.meeting_time)
                ? undefined
                : `Չեղարկել հնարավոր է միայն արշավից ${CANCEL_WINDOW_HOURS} ժամ առաջ`
            }
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            {busyId === r.id ? "..." : "Չեղարկել գրանցումը"}
          </button>
        </li>
      ))}
    </ul>
  );
}
