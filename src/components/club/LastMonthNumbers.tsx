import { getMonthlyReport } from "@/lib/report/data";
import { addMonths, dateWords, monthOf, monthTitle, todayInYerevan } from "@/lib/calendar";
import { formatAmd } from "@/lib/catalog";
import { getT } from "@/i18n/server";

// Last month's numbers at the top of the club's dashboard (on every plan):
// they appear by themselves when a new month begins.
export default async function LastMonthNumbers({ clubId }: { clubId: string }) {
  const t = await getT();
  const month = addMonths(monthOf(todayInYerevan()), -1);
  const { totals } = await getMonthlyReport(clubId, month);
  const cells: [string, string][] = [
    [t("report.hikes_total"), String(totals.hikes)],
    [t("report.overnight"), String(totals.overnight)],
    [t("report.bookings_total"), String(totals.booked)],
    [t("report.cancellations"), String(totals.cancelled)],
    [t("report.attendance"), `${totals.came} / ${totals.absent}`],
    [t("report.revenue"), formatAmd(totals.revenue)],
    [t("report.followers"), String(totals.followers)],
    [t("report.comments"), String(totals.comments)],
    [t("report.rating"), totals.rating ? totals.rating.average.toFixed(1) : "—"],
  ];
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold text-heading">{t("dashboard.lastMonth", { month: monthTitle(month, dateWords(t)) })}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {totals.regions.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          {t("dashboard.lastMonthRegions")} {totals.regions.map((r) => t(`region.${r}`)).join(", ")}
        </p>
      )}
    </section>
  );
}
