"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_CANCEL_HOURS, canCancelBooking, formatAmd } from "@/lib/catalog";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useT } from "@/i18n/client";
import PaymentSheet, { type ChargeResponse } from "./PaymentSheet";

type BookingRow = { id: string; status: "confirmed" | "cancelled" };

// Sign-up card for a single hike: free places, then register / pay / cancel
// with the reason when that is not possible. Registration goes through
// /api/bookings (or /api/payments/charge for a paid hike) so the server
// writes the booking and sends the emails.
export default function TourSignup({
  tourId,
  clubId,
  date,
  taken,
  limit,
  total,
  meetingTime = null,
  cancelHours = DEFAULT_CANCEL_HOURS,
  price = 0,
  bare = false,
}: {
  tourId: string;
  clubId?: string; // the club running the hike: its owner gets "edit" instead of "sign up"
  date: string;
  taken: number;
  limit: number; // seats the platform accepts (the club's package)
  total?: number; // the hike's own size, set by the club — display only
  meetingTime?: string | null;
  cancelHours?: number; // the club's cancel window
  price?: number;
  bare?: boolean; // no card frame (inside a modal footer)
}) {
  const t = useT();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [ownsTour, setOwnsTour] = useState(false);
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setReady(true);
      setSignedIn(true);
      const [{ data: profile }, { data: row }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).single(),
        supabase.from("bookings").select("id, status").eq("tour_id", tourId).eq("user_id", auth.user.id).maybeSingle(),
      ]);
      const userRole = (profile as { role?: string } | null)?.role ?? null;
      setRole(userRole);
      if (userRole === "club" && clubId) {
        const { data: own } = await supabase.from("clubs").select("id").eq("owner_id", auth.user.id).maybeSingle();
        setOwnsTour((own as { id?: string } | null)?.id === clubId);
      }
      setBooking((row as BookingRow) ?? null);
      setReady(true);
    })();
  }, [tourId, clubId]);

  const isPast = date < new Date().toISOString().slice(0, 10);
  const confirmed = booking?.status === "confirmed";
  const free = Math.max(0, limit - taken);
  const full = free <= 0;
  const closed = limit <= 0; // hidden/cancelled hike or the club's package lapsed
  const cancellable = canCancelBooking(date, meetingTime, cancelHours);

  async function book() {
    setError(null);
    if (!signedIn) return router.push(`/login?next=/tours/${tourId}`);
    // A paid hike is paid first; the charge route then creates the booking.
    if (price > 0) return setShowPay(true);

    setBusy(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tour_id: tourId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; booking?: { id: string } };
    setBusy(false);
    if (!res.ok) return setError(serverErrorMessage(t, data.error));
    if (data.booking?.id) setBooking({ id: data.booking.id, status: "confirmed" });
    router.refresh();
  }

  function onPaid(data: ChargeResponse) {
    setShowPay(false);
    if (data.booking?.id) setBooking({ id: data.booking.id, status: "confirmed" });
    router.refresh();
  }

  async function cancel() {
    if (!booking || !confirm(t("signup.confirmCancel"))) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", booking_id: booking.id }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(serverErrorMessage(t, data.error));
    setBooking({ ...booking, status: "cancelled" });
    router.refresh();
  }

  const primary =
    "w-full rounded-full bg-spruce-500 py-3 font-semibold text-white hover:bg-spruce-900 disabled:cursor-not-allowed disabled:bg-spruce-500/50";

  return (
    <div className={bare ? "" : "rounded-2xl border border-line bg-surface p-5"}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-muted">
          {closed ? t("signup.closed") : full ? t("signup.full") : t("signup.seatsLeft", { free, cap: Math.max(total ?? limit, limit) })}
        </p>
        <p className="font-semibold text-heading">
          {price > 0 ? t("common.perPerson", { price: formatAmd(price) }) : t("common.free")}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
        <div
          className={`h-full rounded-full ${full ? "bg-red-400" : "bg-spruce-500"}`}
          style={{ width: `${limit > 0 ? Math.min(100, Math.round((taken / limit) * 100)) : 100}%` }}
        />
      </div>

      <div className="mt-4">
        {!ready ? (
          <p className="text-sm text-muted">{t("common.loading")}</p>
        ) : ownsTour ? (
          <Link href={`/dashboard/listings/${tourId}/edit`} className={`${primary} block text-center`}>
            {t("signup.editOwn")}
          </Link>
        ) : isPast ? (
          <p className="text-sm text-muted">{t("signup.past")}</p>
        ) : role === "club" ? (
          <div className="space-y-2">
            <button type="button" disabled className={primary}>
              {t("signup.book")}
            </button>
            <p className="text-xs text-muted">{t("signup.clubsCannot")}</p>
          </div>
        ) : showPay ? (
          <PaymentSheet
            kind="booking"
            amount={price}
            label={t("signup.paymentLabel")}
            tourId={tourId}
            onCancel={() => setShowPay(false)}
            onSuccess={onPaid}
          />
        ) : confirmed ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">{t("signup.booked")}</p>
            <button
              type="button"
              onClick={cancel}
              disabled={busy || !cancellable}
              className="w-full rounded-lg border border-line py-2.5 text-sm font-semibold text-ink hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "..." : t("signup.cancelBooking")}
            </button>
          </div>
        ) : !signedIn ? (
          <button type="button" onClick={book} disabled={closed} className={primary}>
            {t("signup.loginToBook")}
          </button>
        ) : (
          <button type="button" onClick={book} disabled={busy || full || closed} className={primary}>
            {busy
              ? t("signup.booking")
              : closed
                ? t("signup.closed")
                : full
                  ? t("signup.full")
                  : booking?.status === "cancelled"
                    ? t("signup.bookAgain")
                    : price > 0
                      ? t("signup.bookAndPay", { price: formatAmd(price) })
                      : t("signup.book")}
          </button>
        )}
      </div>

      {confirmed && !isPast && (
        <p className="mt-3 text-xs text-muted">
          {cancellable
            ? t("signup.cancelHint", { hours: cancelHours })
            : t("signup.tooLateHint", { hours: cancelHours })}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
