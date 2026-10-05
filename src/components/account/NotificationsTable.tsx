"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFormatDate, useT } from "@/i18n/client";
import Modal from "@/components/ui/Modal";

export type NotificationRow = {
  id: string;
  kind: "new_tour" | "tour_cancelled" | "tour_changed" | "platform";
  sender_type: "club" | "platform";
  message: string;
  read: boolean;
  created_at: string;
  clubs: { id: string; name: string } | null;
  tours: { id: string; title: string; date: string } | null;
};

// Date · From (a club or the platform) · Subject · View / Delete.
export default function NotificationsTable({ rows }: { rows: NotificationRow[] }) {
  const t = useT();
  const fmt = useFormatDate();
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [open, setOpen] = useState<NotificationRow | null>(null);

  const title = (n: NotificationRow) => {
    const tour = n.tours?.title ?? n.message;
    switch (n.kind) {
      case "new_tour":
        return t("account.notifNewTour", { title: tour });
      case "tour_cancelled":
        return t("account.notifCancelled", { title: tour });
      case "tour_changed":
        return t("account.notifChanged", { title: tour });
      default:
        return n.message;
    }
  };
  const text = (n: NotificationRow) => {
    const vars = { club: n.clubs?.name ?? "", title: n.tours?.title ?? n.message };
    if (n.kind === "new_tour") return t("account.notifNewTourText", vars);
    if (n.kind === "tour_cancelled") return t("account.notifCancelledText", vars);
    if (n.kind === "tour_changed") return t("account.notifChangedText", vars);
    return n.message;
  };

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setList((cur) => cur.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    await createClient().from("notifications").update({ read: true }).in("id", ids);
    router.refresh(); // header and sidebar badges
  }

  async function view(n: NotificationRow) {
    setOpen(n);
    if (!n.read) await markRead([n.id]);
  }

  async function remove(n: NotificationRow) {
    setList((cur) => cur.filter((x) => x.id !== n.id));
    await createClient().from("notifications").delete().eq("id", n.id);
    router.refresh();
  }

  if (list.length === 0) {
    return <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("account.notifEmpty")}</p>;
  }

  const unread = list.filter((n) => !n.read).map((n) => n.id);
  const when = (iso: string) => fmt(iso, "dateTime");

  return (
    <div className="space-y-3">
      {unread.length > 0 && (
        <div className="flex justify-end">
          <button type="button" onClick={() => markRead(unread)} className="text-sm font-semibold text-apricot hover:text-apricot-dark">
            {t("account.markAllRead")}
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">{t("account.colDate")}</th>
              <th className="px-4 py-3">{t("account.colSender")}</th>
              <th className="px-4 py-3">{t("account.colTitle")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((n) => (
              <tr key={n.id} className={`border-b border-line last:border-0 text-ink ${n.read ? "" : "font-bold"}`}>
                <td className="whitespace-nowrap px-4 py-3">
                  {!n.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-600 align-middle" aria-hidden />}
                  {when(n.created_at)}
                </td>
                <td className="px-4 py-3">
                  {n.sender_type === "platform" || !n.clubs ? (
                    "Highland"
                  ) : (
                    <Link href={`/clubs/${n.clubs.id}`} className="hover:text-apricot-dark">{n.clubs.name}</Link>
                  )}
                </td>
                <td className="px-4 py-3">{title(n)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-3 font-semibold">
                    <button data-view type="button" onClick={() => view(n)} className="text-apricot hover:text-apricot-dark">{t("common.view")}</button>
                    <button type="button" onClick={() => remove(n)} className="text-red-600 hover:text-red-700">{t("common.delete")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? title(open) : ""}>
        {open && (
          <div className="space-y-4 text-sm text-ink">
            <p className="text-xs text-muted">{when(open.created_at)}</p>
            <p className="leading-6">{text(open)}</p>
            {open.tours && open.kind !== "tour_cancelled" && (
              <Link href={`/tours/${open.tours.id}`} className="inline-block rounded-lg bg-apricot px-4 py-2 font-semibold text-white hover:bg-apricot-dark">
                {t("account.openTour")}
              </Link>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
