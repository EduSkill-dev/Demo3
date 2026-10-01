"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type BookingRow = { id: string; status: "confirmed" | "cancelled" };

// Sign-up card for a single tour: shows free seats, lets an individual
// register/cancel, and explains why when that is not possible.
export default function TourSignup({
  tourId,
  date,
  taken,
  limit,
}: {
  tourId: string;
  date: string;
  taken: number;
  limit: number;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function book() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setBusy(false);
      return router.push(`/login?next=/tours/${tourId}`);
    }

    let error: string | null = null;
    if (booking?.status === "cancelled") {
      // Re-activating the cancelled signup instead of inserting a new row.
      const res = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", booking.id);
      error = res.error?.message ?? null;
      if (!error) setBooking({ ...booking, status: "confirmed" });
    } else {
      const res = await supabase
        .from("bookings")
        .insert({ tour_id: tourId, user_id: auth.user.id, status: "confirmed" });
      error = res.error?.message ?? null;
      if (!error) setBooking({ id: "", status: "confirmed" });
    }

    setBusy(false);
    if (error) setError(prettyError(error));
    else router.refresh();
  }

  async function cancel() {
    if (!booking || !confirm("Չեղարկե՞լ գրանցումդ։")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);
    setBusy(false);
    if (error) setError(prettyError(error.message));
    else {
      setBooking({ ...booking, status: "cancelled" });
      router.refresh();
    }
  }

  return (
    <div className="rounded-2xl border border-sand bg-white p-5">
      <p className="text-sm text-neutral-500">
        {full ? "Տեղերը լրացած են" : `Ազատ տեղեր՝ ${free} / ${limit}`}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
        <div
          className={`h-full rounded-full ${full ? "bg-red-400" : "bg-apricot"}`}
          style={{ width: `${Math.min(100, Math.round((taken / limit) * 100))}%` }}
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
        ) : confirmed ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">
              ✓ Գրանցված ես այս արշավին
            </p>
            <button
              onClick={cancel}
              disabled={busy}
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
            disabled={busy || full}
            className="w-full rounded-lg bg-apricot py-3 font-semibold text-white hover:bg-apricot-dark disabled:cursor-not-allowed disabled:bg-apricot/50"
            title={full ? "Տեղերը լրացած են" : undefined}
          >
            {busy
              ? "Գրանցվում է..."
              : booking?.status === "cancelled"
                ? "Վերականգնել գրանցումը"
                : full
                  ? "Տեղերը լրացած են"
                  : "Գրանցվել արշավին"}
          </button>
        )}
      </div>

      {confirmed && !isPast && (
        <p className="mt-3 text-xs text-neutral-400">
          Չեղարկելու ժամկետը նշում է ակումբը՝ արշավի նկարագրության մեջ։
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
