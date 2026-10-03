import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { getT } from "@/i18n/server";
import ApplicationsTable, { type ApplicationRow } from "@/components/club/ApplicationsTable";

type Raw = {
  id: string;
  seq: number;
  status: "confirmed" | "cancelled";
  created_at: string;
  cancelled_at: string | null;
  read_at: string | null;
  tour_id: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    birth_date: string | null;
    age: number | null;
    gender: string | null;
    email: string;
    phone: string | null;
  } | null;
};

export default async function ApplicationsPage() {
  const mine = await getMyClub();
  if (!mine) redirect("/login");
  const { club, limits } = mine;
  const t = await getT();
  const supabase = await createClient();

  const { data: tourRows } = await supabase
    .from("tours")
    .select("id, title, date, max_participants, status")
    .eq("club_id", club.id);
  const tours = new Map(
    ((tourRows ?? []) as { id: string; title: string; date: string; max_participants: number; status: string }[]).map((x) => [x.id, x])
  );

  const { data } = tours.size
    ? await supabase
        .from("bookings")
        .select("id, seq, status, created_at, cancelled_at, read_at, tour_id, profiles(first_name, last_name, birth_date, age, gender, email, phone)")
        .in("tour_id", [...tours.keys()])
        .order("created_at", { ascending: false })
    : { data: [] };

  const today = new Date().toISOString().slice(0, 10);
  const rows: ApplicationRow[] = ((data ?? []) as unknown as Raw[]).map((b) => {
    const tour = tours.get(b.tour_id)!;
    return {
      id: b.id,
      seq: b.seq,
      status: b.status,
      createdAt: b.created_at,
      cancelledAt: b.cancelled_at,
      unread: !b.read_at,
      tourTitle: tour.title,
      tourDate: tour.date,
      cap: limits.pkg ? Math.min(tour.max_participants, limits.maxPerTour) : tour.max_participants,
      person: b.profiles,
    };
  });

  // N/M: live applications on upcoming tours, against what the package allows
  // in total (listings × applications per listing).
  const used = rows.filter((r) => r.status === "confirmed" && r.tourDate >= today).length;
  const max = limits.maxListings * limits.maxPerTour;

  return (
    <div className="space-y-5">
      <p className="font-semibold text-ink">{t("applications.counter", { used, max })}</p>
      <ApplicationsTable rows={rows} />
    </div>
  );
}
