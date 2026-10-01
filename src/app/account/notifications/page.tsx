"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface NotificationRow {
  id: string;
  club_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setLoading(false);
    setUserId(auth.user.id);
    const { data } = await supabase
      .from("notifications")
      .select("id, club_id, message, read, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data ?? []) as NotificationRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row || row.read) return;
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, read: true } : r)));
  }

  async function markAllRead() {
    if (!userId) return;
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    setRows((cur) => cur.map((r) => ({ ...r, read: true })));
  }

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;

  const unread = rows.filter((r) => !r.read).length;

  if (rows.length === 0)
    return (
      <p className="text-neutral-500">
        Դեռ ծանուցում չկա։ Ավելացրու ակումբ սիրվածների մեջ՝ ու կիմանաս, երբ նրանք նոր
        արշավ հրապարակեն։
      </p>
    );

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {unread > 0 ? `Կարդացված չէ՝ ${unread}` : "Բոլորը կարդացված են"}
        </p>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm font-semibold text-apricot hover:text-apricot-dark"
          >
            Նշել բոլորը կարդացված
          </button>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/clubs/${r.club_id}`}
              onClick={() => markRead(r.id)}
              className={`flex items-start justify-between gap-4 rounded-xl border p-4 text-sm transition ${
                r.read
                  ? "border-sand bg-white text-neutral-600"
                  : "border-apricot/40 bg-apricot/5 text-neutral-800"
              }`}
            >
              <span>
                {!r.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-apricot align-middle" />}
                {r.message}
              </span>
              <span className="shrink-0 text-xs text-neutral-400">
                {r.created_at.slice(0, 10)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
