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
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  attended: boolean | null;
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
  if (limits.pkg && !limits.config.dashboard_registrants_list) {
    return <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("applications.notInPlan")}</p>;
  }
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
        .select("id, seq, status, created_at, cancelled_at, read_at, tour_id, emergency_contact_name, emergency_contact_phone, attended, profiles(first_name, last_name, birth_date, age, gender, email, phone)")
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
      attended: b.attended,
      emergency: b.emergency_contact_name && b.emergency_contact_phone ? { name: b.emergency_contact_name, phone: b.emergency_contact_phone } : null,
    };
  });

  // N/M: live applications on upcoming tours, against what the package allows
  // in total (listings × applications per listing).
  const used = rows.filter((r) => r.status === "confirmed" && r.tourDate >= today).length;
  const max = limits.maxListings * limits.maxPerTour;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-ink">{t("applications.counter", { used, max })}</p>
        {limits.config.registrants_csv_export && rows.length > 0 && (
          <a data-view href="/api/club/registrants" download className="rounded-full border-2 border-spruce-900 px-4 py-2 text-sm font-semibold text-ink hover:bg-sand dark:border-line">
            {t("applications.exportCsv")}
          </a>
        )}
      </div>
      <ApplicationsTable rows={rows} />
    </div>
  );
}
