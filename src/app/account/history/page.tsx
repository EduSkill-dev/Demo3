import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import type { Tour } from "@/types/database";
import type { ReceiptPayment } from "@/components/ReceiptView";
import HistoryTable, { type HistoryRow } from "@/components/account/HistoryTable";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const t = await getT();

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: bookings }, { data: payments }, { data: profile }] = await Promise.all([
    supabase.from("bookings").select("id, tours(*, clubs(id, name, cancel_hours))").eq("user_id", user.id).eq("status", "confirmed"),
    supabase
      .from("payments")
      .select("id, tour_id, created_at, amount, currency, card_last4, period_start, period_end")
      .eq("user_id", user.id)
      .eq("kind", "booking")
      .eq("status", "succeeded")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("first_name, last_name, email").eq("id", user.id).single(),
  ]);

  // The latest successful payment for each tour is its receipt.
  const receiptByTour = new Map<string, ReceiptPayment>();
  for (const p of (payments ?? []) as (ReceiptPayment & { tour_id: string | null })[]) {
    if (p.tour_id && !receiptByTour.has(p.tour_id)) receiptByTour.set(p.tour_id, p);
  }

  type Raw = { id: string; tours: (Tour & { clubs: { id: string; name: string } | null }) | null };
  const rows: HistoryRow[] = ((bookings ?? []) as unknown as Raw[])
    .filter((b) => b.tours && b.tours.date < today && b.tours.status !== "cancelled")
    .map((b) => {
      const { clubs, ...tour } = b.tours!;
      return { bookingId: b.id, tour: { ...tour, club: clubs }, receipt: receiptByTour.get(tour.id) ?? null };
    })
    .sort((a, b) => (a.tour.date > b.tour.date ? -1 : 1));

  const prof = profile as { first_name: string | null; last_name: string | null; email: string } | null;
  const payer = [[prof?.first_name, prof?.last_name].filter(Boolean).join(" "), prof?.email].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <p className="font-semibold text-ink">{t("account.historyCount", { count: rows.length })}</p>
      <HistoryTable rows={rows} payer={payer} />
    </div>
  );
}
