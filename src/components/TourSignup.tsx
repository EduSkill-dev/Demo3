"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_CANCEL_HOURS, canCancelBooking, formatAmd } from "@/lib/catalog";
import { serverErrorMessage } from "@/lib/serverErrors";
import { parseEmergency } from "@/lib/emergency";
import { useT } from "@/i18n/client";
import GuestBookingForm from "@/components/tour/GuestBookingForm";
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
  const [guestOpen, setGuestOpen] = useState(false);
  // Optional emergency contact, pre-filled from the one saved earlier.
  const [emName, setEmName] = useState("");
  const [emPhone, setEmPhone] = useState("");
  const [emRemember, setEmRemember] = useState(false);
  const emergency = { name: emName, phone: emPhone, remember: emRemember };

  // A shared link carries ?ref=<network>. It is remembered for this hike
  // while the tab is open, so signing in on the way does not lose it.
  const sourceOf = () => {
    try {
      return sessionStorage.getItem(`ref:${tourId}`);
    } catch {
      return null;
    }
  };
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) sessionStorage.setItem(`ref:${tourId}`, ref.slice(0, 20));
    } catch {
      /* private mode */
    }
  }, [tourId]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setReady(true);
      setSignedIn(true);
      const [{ data: saved }, { data: profile }, { data: row }] = await Promise.all([
        supabase.from("emergency_contacts").select("name, phone").eq("user_id", auth.user.id).maybeSingle(),
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
      const contact = saved as { name: string; phone: string } | null;
      if (contact) {
        setEmName(contact.name);
        setEmPhone(contact.phone);
        setEmRemember(true);
      }
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
    const checked = parseEmergency(emergency);
    if (!checked.ok) return setError(serverErrorMessage(t, checked.error));
    // A paid hike is paid first; the charge route then creates the booking.
    if (price > 0) return setShowPay(true);

    setBusy(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tour_id: tourId, emergency, source: sourceOf() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; booking?: { id: string } };
    if (data.code === "profile_incomplete") return router.push(`/account/complete?next=/tours/${tourId}`);
    setBusy(false);
    if (!res.ok) return setError(serverErrorMessage(t, data.error));
    if (data.booking?.id) setBooking({ id: data.booking.id, status: "confirmed" });
    router.refresh();
  }

  async function onPaid(data: ChargeResponse) {
    setShowPay(false);
    if (data.booking?.id) {
      setBooking({ id: data.booking.id, status: "confirmed" });
      const source = sourceOf();
      if (source) {
        fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "source", booking_id: data.booking.id, source }) }).catch(() => {});
      }
      // The payment route made the booking; the contact follows it.
      if (emName.trim() || emPhone.trim()) {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "emergency", booking_id: data.booking.id, emergency }),
        });
        if (!res.ok) setError(serverErrorMessage(t, ((await res.json().catch(() => ({}))) as { error?: string }).error));
      }
    }
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

  const field =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30";
  const emergencyFields = !full && !closed && role === "individual" && (
    <details className="group mb-3 rounded-xl border border-line bg-sand/50 px-3 py-2.5" open={!!(emName || emPhone) || undefined}>
      <summary className="cursor-pointer select-none text-sm font-semibold text-ink">{t("signup.emergencyTitle")}</summary>
      <div className="mt-2.5 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <input aria-label={t("signup.emergencyName")} placeholder={t("signup.emergencyName")} maxLength={80} autoComplete="off" value={emName} onChange={(e) => setEmName(e.target.value)} className={field} />
          <input aria-label={t("signup.emergencyPhone")} placeholder={t("signup.emergencyPhone")} type="tel" maxLength={20} pattern="[+0-9 \(\)\-]{6,20}" autoComplete="off" value={emPhone} onChange={(e) => setEmPhone(e.target.value)} className={field} />
        </div>
        <label className="flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" checked={emRemember} onChange={(e) => setEmRemember(e.target.checked)} className="accent-spruce-500" />
          {t("signup.emergencyRemember")}
        </label>
        <p className="text-xs text-muted">{t("signup.emergencyHint")}</p>
      </div>
    </details>
  );

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
          <Link href={isPast ? `/dashboard/listings/new?from=${tourId}` : `/dashboard/listings/${tourId}/edit`} className={`${primary} block text-center`}>
            {isPast ? t("announcements.republish") : t("signup.editOwn")}
          </Link>
        ) : isPast ? (
          <p className="text-sm text-muted">{t("signup.past")}</p>
        ) : role === "club" || role === "admin" ? (
          // Only individuals book: a club or admin account sees the button, plainly off.
          <div className="space-y-2">
            <button type="button" disabled aria-disabled="true" className="w-full cursor-not-allowed rounded-full border border-line bg-sand py-3 font-semibold text-muted">
              {t("signup.book")}
            </button>
            <p className="text-xs text-muted">{role === "club" ? t("signup.clubsCannot") : t("signup.adminsCannot")}</p>
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
          // Not signed in: "Book" opens the short form (or Google / sign-in above it).
          guestOpen ? (
            <GuestBookingForm tourId={tourId} price={price} source={sourceOf} />
          ) : (
            <button type="button" onClick={() => setGuestOpen(true)} disabled={closed || full} className={primary}>
              {closed ? t("signup.closed") : full ? t("signup.full") : t("signup.book")}
            </button>
          )
        ) : (
          <>
          {emergencyFields}
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
          </>
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
