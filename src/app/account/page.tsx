import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import type { Tour } from "@/types/database";
import MyTours, { type MyTourRow } from "@/components/account/MyTours";

export default async function MyToursPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const t = await getT();

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("bookings")
    .select("id, tours(*, clubs(id, name))")
    .eq("user_id", user.id)
    .eq("status", "confirmed");

  type Raw = { id: string; tours: (Tour & { clubs: { id: string; name: string } | null }) | null };
  const rows: MyTourRow[] = ((data ?? []) as unknown as Raw[])
    .filter((b) => b.tours && b.tours.date >= today)
    .map((b) => {
      const { clubs, ...tour } = b.tours!;
      return { bookingId: b.id, tour: { ...tour, club: clubs } };
    })
    .sort((a, b) => (a.tour.date < b.tour.date ? -1 : 1));

  return (
    <div className="space-y-5">
      {rows.length > 0 && <p className="font-semibold text-ink">{t("account.toursCount", { count: rows.length })}</p>}
      <MyTours rows={rows} />
    </div>
  );
}
