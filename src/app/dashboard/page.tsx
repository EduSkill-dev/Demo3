import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CopyLinkButton from "@/components/ui/CopyLinkButton";
import { getShareNetworks } from "@/lib/siteSettings";
import { getMyClub } from "@/lib/myClub";
import { getT } from "@/i18n/server";
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
      endDate: tour.end_date,
      difficulty: tour.difficulty,
      overnight: tour.overnight,
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

  // How many people follow (bookmarked) the club. Counted on the server:
  // a club cannot read who they are.
  const { count: followers } = await createAdminClient().from("favorite_clubs").select("user_id", { count: "exact", head: true }).eq("club_id", club.id);
  const pagePath = `/clubs/${club.slug ?? club.id}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-ink">{t("dashboard.pageLink")}</span>
          <Link href={pagePath} className="break-all text-terracotta-500 hover:text-terracotta-700">{pagePath}</Link>
          <CopyLinkButton href={pagePath} label={t("share.copyLink")} copiedLabel={t("calendar.copied")} className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink hover:border-spruce-500" />
        </p>
        <p className="whitespace-nowrap font-semibold text-ink">{t("dashboard.followers", { count: followers ?? 0 })}</p>
      </div>
      {!limits.pkg && (
        <div className="rounded-xl border border-terracotta-500/40 bg-terracotta-500/10 p-4 text-sm text-ink">
          {t("announcements.noPackage")}{" "}
          <Link href="/dashboard/packages" className="font-semibold text-terracotta-700 underline dark:text-terracotta-300">
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
        <div className="rounded-xl border border-terracotta-500/40 bg-terracotta-500/10 p-4 text-sm text-ink">
          {t("announcements.atLimit", { name: limits.planName, max: limits.maxListings })}{" "}
          <Link href="/dashboard/packages" className="font-semibold text-terracotta-700 underline dark:text-terracotta-300">
            {t("announcements.atLimitLink")}
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-ink">
          {t("announcements.counter", { used: limits.used, max: limits.maxListings })}
        </p>
        {canAdd ? (
          <Link href="/dashboard/listings/new" className="rounded-full bg-spruce-500 px-4 py-2 text-sm font-semibold text-white hover:bg-spruce-900">
            {t("announcements.new")}
          </Link>
        ) : (
          <span aria-disabled className="cursor-not-allowed rounded-full bg-spruce-500/40 px-4 py-2 text-sm font-semibold text-white">
            {t("announcements.new")}
          </span>
        )}
      </div>

      <AnnouncementsTable rows={rows} canRepublish={canAdd} clubName={club.name} shareNetworks={limits.config.share_buttons ? await getShareNetworks() : []} />
    </div>
  );
}
