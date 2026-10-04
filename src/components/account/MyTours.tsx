"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CANCEL_WINDOW_HOURS, canCancelBooking } from "@/lib/catalog";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useFormatDate, useT } from "@/i18n/client";
import Modal from "@/components/ui/Modal";
import TourDetails, { type TourForDetails } from "@/components/tour/TourDetails";
import type { TourStatus } from "@/types/database";

export type MyTourRow = { bookingId: string; tour: TourForDetails & { status: TourStatus } };

// Upcoming hikes: name, date, region, overnight, coordinator phone, then
// View (full announcement) and Cancel (only while more than 48 h remain).
export default function MyTours({ rows }: { rows: MyTourRow[] }) {
  const t = useT();
  const fmt = useFormatDate();
  const router = useRouter();
  const [open, setOpen] = useState<MyTourRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function cancel(row: MyTourRow) {
    if (!confirm(t("account.confirmCancel", { title: row.tour.title }))) return;
    setBusy(row.bookingId);
    setMessage(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", booking_id: row.bookingId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) return setMessage({ ok: false, text: serverErrorMessage(t, data.error) });
    setMessage({ ok: true, text: t("account.cancelledOk") });
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-muted">{t("account.toursEmpty")}</p>
        <Link href="/tours" className="mt-4 inline-block rounded-lg bg-apricot px-5 py-2.5 text-sm font-semibold text-white hover:bg-apricot-dark">
          {t("account.findTours")}
        </Link>
      </div>
    );
  }

  const day = (d: string) => fmt(d, "short");

  return (
    <>
      {message && (
        <p className={`rounded-lg p-3 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">{t("account.colTour")}</th>
              <th className="px-4 py-3">{t("account.colDate")}</th>
              <th className="px-4 py-3">{t("account.colRegion")}</th>
              <th className="px-4 py-3">{t("account.colOvernight")}</th>
              <th className="px-4 py-3">{t("account.colCoordinator")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cancelled = r.tour.status === "cancelled";
              const can = !cancelled && canCancelBooking(r.tour.date, r.tour.meeting_time);
              return (
                <tr key={r.bookingId} className="border-b border-line last:border-0 text-ink">
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.tour.title}</span>
                    {r.tour.club && <span className="block text-xs text-muted">{r.tour.club.name}</span>}
                    {cancelled && (
                      <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                        {t("announcements.cancelled")}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{day(r.tour.date)}</td>
                  <td className="px-4 py-3 text-muted">{r.tour.regions.map((x) => t(`region.${x}`)).join(", ")}</td>
                  <td className="px-4 py-3">{r.tour.overnight ? "🌙 " + t("tour.yes") : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <a href={`tel:${r.tour.coordinator_phone.replace(/\s/g, "")}`} className="hover:text-apricot">{r.tour.coordinator_phone}</a>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-3 font-semibold">
                      <button type="button" onClick={() => setOpen(r)} className="text-apricot hover:text-apricot-dark">
                        {t("common.view")}
                      </button>
                      {!cancelled && (
                        <button
                          type="button"
                          onClick={() => cancel(r)}
                          disabled={!can || busy === r.bookingId}
                          title={can ? undefined : t("account.cancelTooLate", { hours: CANCEL_WINDOW_HOURS })}
                          className="text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60"
                        >
                          {busy === r.bookingId ? "..." : t("common.cancel")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{t("account.cancelTooLate", { hours: CANCEL_WINDOW_HOURS })}</p>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.tour.title ?? ""} size="lg">
        {open && <TourDetails tour={open.tour} />}
      </Modal>
    </>
  );
}
