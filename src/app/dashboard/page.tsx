import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { getT } from "@/i18n/server";
import { PACKAGES } from "@/lib/catalog";
import type { Tour } from "@/types/database";
import AnnouncementsTable, { type ListingRow } from "@/components/club/AnnouncementsTable";

export default async function AnnouncementsPage() {
  const mine = await getMyClub();
  if (!mine) redirect("/login");
  const { club, limits } = mine;
  const t = await getT();
  const supabase = await createClient();

  const { data: tourRows } = await supabase
    .from("tours")
    .select("*")
    .eq("club_id", club.id)
    .order("date", { ascending: true });
  const tours = (tourRows ?? []) as Tour[];

  const { data: bookingRows } = tours.length
    ? await supabase.from("bookings").select("tour_id, status, read_at").in("tour_id", tours.map((x) => x.id))
    : { data: [] };
  const bookings = (bookingRows ?? []) as { tour_id: string; status: string; read_at: string | null }[];

  const today = new Date().toISOString().slice(0, 10);
  const rows: ListingRow[] = tours.map((tour) => {
    const mineB = bookings.filter((b) => b.tour_id === tour.id);
    return {
      id: tour.id,
      title: tour.title,
      date: tour.date,
      regions: tour.regions,
      status: tour.status,
      adminHidden: tour.admin_hidden,
      taken: mineB.filter((b) => b.status === "confirmed").length,
      cap: limits.pkg ? Math.min(tour.max_participants, limits.maxPerTour) : tour.max_participants,
      unread: mineB.filter((b) => !b.read_at).length,
      past: tour.date < today,
    };
  });

  const canAdd = limits.used < limits.maxListings && !club.posting_blocked;

  return (
    <div className="space-y-5">
      {!limits.pkg && (
        <div className="rounded-xl border border-apricot/40 bg-apricot/10 p-4 text-sm text-ink">
          {t("announcements.noPackage")}{" "}
          <Link href="/dashboard/packages" className="font-semibold text-apricot-dark underline dark:text-apricot">
            {t("announcements.noPackageLink")}
          </Link>
        </div>
      )}
      {club.posting_blocked && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {t("announcements.postingBlocked")}
        </p>
      )}
      {club.applications_blocked && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {t("announcements.applicationsBlocked")}
        </p>
      )}
      {limits.pkg && limits.used >= limits.maxListings && (
        <div className="rounded-xl border border-apricot/40 bg-apricot/10 p-4 text-sm text-ink">
          {t("announcements.atLimit", { name: PACKAGES[limits.pkg].name, max: limits.maxListings })}{" "}
          <Link href="/dashboard/packages" className="font-semibold text-apricot-dark underline dark:text-apricot">
            {t("announcements.atLimitLink")}
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-ink">
          {t("announcements.counter", { used: limits.used, max: limits.maxListings })}
        </p>
        {canAdd ? (
          <Link href="/dashboard/listings/new" className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark">
            {t("announcements.new")}
          </Link>
        ) : (
          <span aria-disabled className="cursor-not-allowed rounded-lg bg-apricot/40 px-4 py-2 text-sm font-semibold text-white">
            {t("announcements.new")}
          </span>
        )}
      </div>

      <AnnouncementsTable rows={rows} />
    </div>
  );
}
