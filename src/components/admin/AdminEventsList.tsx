"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EVENT_KINDS, type AdminEvent } from "@/lib/adminEventKinds";

const fmt = new Intl.DateTimeFormat("hy-AM", { timeZone: "Asia/Yerevan", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The bell's list. What came after the admin's last visit stays marked new
// for this visit, while the bell itself is cleared at once.
export default function AdminEventsList({ events, seenAt }: { events: AdminEvent[]; seenAt: string | null }) {
  const router = useRouter();
  const [since] = useState(seenAt); // kept across the refresh below
  const isNew = (e: AdminEvent) => !!since && e.created_at > since;
  const fresh = events.filter(isNew).length;

  useEffect(() => {
    if (!seenAt || !events.some((e) => e.created_at > seenAt)) return;
    fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "events.seen" }) }).then(() => router.refresh());
  }, [events, seenAt, router]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{fresh > 0 ? `Նոր՝ ${fresh}։` : "Նոր ծանուցումներ չկան։"} Ցույց են տրվում վերջին 200-ը։</p>
      {events.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">Ծանուցումներ դեռ չկան։</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {events.map((e) => {
            const kind = EVENT_KINDS[e.kind] ?? { label: e.kind, icon: "🔔" };
            const body = (
              <>
                <span className="mt-0.5 w-6 shrink-0 text-center text-lg leading-none" aria-hidden="true">{kind.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span className="font-semibold uppercase tracking-wide">{kind.label}</span>
                    <span>{fmt.format(new Date(e.created_at))}</span>
                  </span>
                  <span className={`mt-0.5 block break-words text-sm text-ink ${isNew(e) ? "font-bold" : ""}`}>{e.title}</span>
                </span>
                {isNew(e) && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="Նոր" />}
              </>
            );
            return (
              <li key={e.id}>
                {e.link ? (
                  <Link href={e.link} className="flex items-start gap-3 px-4 py-3 hover:bg-sand/60">{body}</Link>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
