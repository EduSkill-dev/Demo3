import Link from "next/link";
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
  guests: { first_name: string; last_name: string; birth_date: string; gender: string; email: string; phone: string } | null;
};

// All the club's applications, or one hike's (?tour=<id>, from the listings).
export default async function ApplicationsPage({ searchParams }: { searchParams: { tour?: string } }) {
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

  const only = searchParams.tour && tours.has(searchParams.tour) ? tours.get(searchParams.tour)! : null;
  const { data } = tours.size
    ? await supabase
        .from("bookings")
        .select("id, seq, status, created_at, cancelled_at, read_at, tour_id, emergency_contact_name, emergency_contact_phone, attended, profiles(first_name, last_name, birth_date, age, gender, email, phone), guests(first_name, last_name, birth_date, gender, email, phone)")
        .in("tour_id", only ? [only.id] : [...tours.keys()])
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
      // Booked without an account: the details they gave.
      person: b.profiles ?? (b.guests ? { ...b.guests, age: null } : null),
      guest: !b.profiles && !!b.guests,
      attended: b.attended,
      emergency: b.emergency_contact_name && b.emergency_contact_phone ? { name: b.emergency_contact_name, phone: b.emergency_contact_phone } : null,
    };
  });

  // N/M: live applications on upcoming tours, against what the package allows
  // in total (listings × applications per listing).
  const used = rows.filter((r) => r.status === "confirmed" && r.tourDate >= today).length;
  const max = limits.maxListings * limits.maxPerTour;

  const csvClass = "rounded-full border-2 px-4 py-2 text-sm font-semibold";
  return (
    <div className="space-y-5">
      {only && (
        <div>
          <Link href="/dashboard/applications" className="text-sm font-semibold text-muted hover:text-terracotta-700">{t("applications.allApplications")}</Link>
          <h2 className="mt-1 text-lg font-bold text-heading">{t("applications.forTour", { title: only.title })}</h2>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-ink">{only ? t("applications.forTourCount", { count: rows.filter((r) => r.status === "confirmed").length }) : t("applications.counter", { used, max })}</p>
        {/* CSV: the plan decides; without it the button is there but off. */}
        {limits.config.registrants_csv_export ? (
          rows.length > 0 && (
            <a data-view href={only ? `/api/club/registrants?tour=${only.id}` : "/api/club/registrants"} download className={`${csvClass} border-spruce-900 text-ink hover:bg-sand dark:border-line`}>
              {t("applications.exportCsv")}
            </a>
          )
        ) : (
          <span className={`${csvClass} cursor-not-allowed border-line text-muted opacity-60`} title={t("applications.csvNotInPlan")} aria-disabled="true">
            {t("applications.exportCsv")}
          </span>
        )}
      </div>
      <ApplicationsTable rows={rows} oneTour={!!only} />
    </div>
  );
}
