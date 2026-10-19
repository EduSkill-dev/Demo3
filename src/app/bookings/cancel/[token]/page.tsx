import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getT } from "@/i18n/server";
import { canCancelBooking } from "@/lib/catalog";
import { dateWords, dayInWords } from "@/lib/calendar";
import GuestCancelButton from "@/components/tour/GuestCancelButton";

export const metadata: Metadata = { title: "Culmen", robots: { index: false, follow: false } };

// The link in a guest's confirmation email: the booking, and a button that
// cancels it (within the hike's cancel window). Only the token opens it.
export default async function GuestCancelPage({ params }: { params: { token: string } }) {
  const t = await getT();
  const words = dateWords(t);
  const token = /^[0-9a-f-]{36}$/i.test(params.token) ? params.token : "";
  const { data } = token
    ? await createAdminClient()
        .from("bookings")
        .select("status, guest_id, guests(first_name), tours(id, title, date, meeting_time, cancel_hours, clubs(name))")
        .eq("cancel_token", token)
        .maybeSingle()
    : { data: null };
  const bk = data as unknown as {
    status: string;
    guest_id: string | null;
    guests: { first_name: string } | null;
    tours: { id: string; title: string; date: string; meeting_time: string | null; cancel_hours: number; clubs: { name: string } | null } | null;
  } | null;

  const box = "mx-auto mt-10 max-w-md rounded-2xl border border-line bg-surface p-6 text-center";
  if (!bk || !bk.guest_id || !bk.tours) {
    return (
      <main className="px-4 py-10">
        <div className={box}>
          <p className="text-ink">{t("guest.cancelNotFound")}</p>
          <Link href="/tours" className="mt-4 inline-block font-semibold text-terracotta-700 hover:text-terracotta-500">{t("guest.toTours")}</Link>
        </div>
      </main>
    );
  }
  const tour = bk.tours;
  const allowed = bk.status === "confirmed" && canCancelBooking(tour.date, tour.meeting_time, tour.cancel_hours);
  return (
    <main className="px-4 py-10">
      <div className={box}>
        <h1 className="font-serif text-2xl font-semibold text-heading">{tour.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {dayInWords(tour.date, words)} · {tour.clubs?.name}
        </p>
        <div className="mt-6">
          {bk.status === "cancelled" ? (
            <p className="rounded-lg bg-sand p-3 text-sm font-semibold text-ink">{t("guest.alreadyCancelled")}</p>
          ) : allowed ? (
            <GuestCancelButton token={token} name={bk.guests?.first_name ?? ""} />
          ) : (
            <p className="rounded-lg bg-sand p-3 text-sm text-ink">{t("guest.tooLate", { hours: tour.cancel_hours })}</p>
          )}
        </div>
        <Link href={`/tours/${tour.id}`} className="mt-5 inline-block text-sm font-semibold text-terracotta-700 hover:text-terracotta-500">{t("guest.toTour")}</Link>
      </div>
    </main>
  );
}
