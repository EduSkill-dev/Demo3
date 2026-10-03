"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CANCEL_WINDOW_HOURS, canCancelBooking, formatAmd } from "@/lib/catalog";
import PaymentSheet, { type ChargeResponse } from "./PaymentSheet";

type BookingRow = { id: string; status: "confirmed" | "cancelled" };

// Sign-up card for a single tour: shows free seats, lets an individual
// register/cancel, and explains why when that is not possible.
// Registration goes through /api/bookings so the confirmation/cancellation
// email is sent from the server; a priced tour opens the payment sheet first.
export default function TourSignup({
  tourId,
  date,
  taken,
  limit,
  meetingTime = null,
  price = 0,
}: {
  tourId: string;
  date: string;
  taken: number;
  limit: number;
  meetingTime?: string | null;
  price?: number;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<string | null>(null);
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();
      setRole(profile?.role ?? null);
      const { data: row } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("tour_id", tourId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      setBooking((row as BookingRow) ?? null);
      setReady(true);
    })();
  }, [tourId]);

  const isPast = date < new Date().toISOString().slice(0, 10);
  const confirmed = booking?.status === "confirmed";
  const free = Math.max(0, limit - taken);
  const full = free <= 0;
  const closed = limit <= 0; // hidden/cancelled tour or the club's package lapsed
  const cancellable = canCancelBooking(date, meetingTime);

  async function book() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setBusy(false);
      return router.push(`/login?next=/tours/${tourId}`);
    }

    // A priced tour is paid first; the booking itself is created by the
    // charge route once the card goes through.
    if (price > 0) {
      setBusy(false);
      return setShowPay(true);
    }

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tour_id: tourId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      booking?: { id: string };
    };
    setBusy(false);
    if (!res.ok) return setError(prettyError(data.error ?? "Չստացվեց գրանցվել։"));
    if (data.booking?.id) setBooking({ id: data.booking.id, status: "confirmed" });
    router.refresh();
  }

  function onPaid(data: ChargeResponse) {
    setShowPay(false);
    if (data.booking?.id) setBooking({ id: data.booking.id, status: "confirmed" });
    router.refresh();
  }

  async function cancel() {
    if (!booking || !confirm("Չեղարկե՞լ գրանցումդ։")) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", booking_id: booking.id }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(prettyError(data.error ?? "Չստացվեց չեղարկել։"));
    setBooking({ ...booking, status: "cancelled" });
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-sand bg-white p-5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-neutral-500">
          {closed ? "Գրանցումը փակ է" : full ? "Տեղերը սպառված են" : `Ազատ տեղեր՝ ${free} / ${limit}`}
        </p>
        <p className="font-semibold text-pine">{price > 0 ? formatAmd(price) : "Անվճար"}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
        <div
          className={`h-full rounded-full ${full ? "bg-red-400" : "bg-apricot"}`}
          style={{ width: `${limit > 0 ? Math.min(100, Math.round((taken / limit) * 100)) : 100}%` }}
        />
      </div>

      <div className="mt-4">
        {!ready ? (
          <p className="text-sm text-neutral-500">Բեռնվում է...</p>
        ) : isPast ? (
          <p className="text-sm text-neutral-500">Այս արշավն արդեն տեղի է ունեցել։</p>
        ) : role === "club" ? (
          <p className="text-sm text-neutral-500">
            Ակումբները չեն կարող գրանցվել արշավներին։
          </p>
        ) : showPay ? (
          <PaymentSheet
            kind="booking"
            amount={price}
            label="Արշավի գրանցում"
            tourId={tourId}
            onCancel={() => setShowPay(false)}
            onSuccess={onPaid}
          />
        ) : confirmed ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">
              ✓ Գրանցված ես այս արշավին
            </p>
            <button
              onClick={cancel}
              disabled={busy || !cancellable}
              title={cancellable ? undefined : `Չեղարկել հնարավոր է միայն ${CANCEL_WINDOW_HOURS} ժամ առաջ`}
              className="w-full rounded-lg border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              {busy ? "..." : "Չեղարկել գրանցումը"}
            </button>
          </div>
        ) : !signedIn ? (
          <button
            onClick={book}
            className="w-full rounded-lg bg-apricot py-3 font-semibold text-white hover:bg-apricot-dark"
          >
            Մուտք գործելով գրանցվել
          </button>
        ) : (
          <button
            onClick={book}
            disabled={busy || full || closed}
            className="w-full rounded-lg bg-apricot py-3 font-semibold text-white hover:bg-apricot-dark disabled:cursor-not-allowed disabled:bg-apricot/50"
            title={full ? "Տեղերը լրացած են" : undefined}
          >
            {busy
              ? "Գրանցվում է..."
              : closed
                ? "Գրանցումը փակ է"
                : full
                  ? "Տեղերը սպառված են"
                  : booking?.status === "cancelled"
                  ? "Գրանցվել կրկին"
                  : price > 0
                    ? `Գրանցվել ու վճարել (${formatAmd(price)})`
                    : "Գրանցվել արշավին"}
          </button>
        )}
      </div>

      {confirmed && !isPast && (
        <p className="mt-3 text-xs text-neutral-400">
          {cancellable
            ? `Չեղարկել կարող եք մինչև արշավից ${CANCEL_WINDOW_HOURS} ժամ առաջ, որպեսզի տեղը կարողանա զբաղեցնել ուրիշը։`
            : `Արշավին մնացել է ${CANCEL_WINDOW_HOURS} ժամից պակաս. գրանցումն այլևս չի չեղարկվում։`}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Turns the English Postgres/GoTrue messages into something readable.
function prettyError(message: string) {
  if (message.includes("duplicate key") || message.includes("unique"))
    return "Արդեն գրանցված ես այս արշավին։";
  if (message.includes("Տեղերը լրացած") || message.includes("capacity"))
    return "Տեղերը հենց նոր լրացան, փորձիր ավելի ուշ։";
  if (message.includes("handle_new_user") || message.includes("row-level security"))
    return "Չստացվեց գրանցվել։ Փորձիր նորից։";
  return message;
}
