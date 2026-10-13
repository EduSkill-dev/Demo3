import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyClub } from "@/lib/myClub";
import { getT, getFormatDate } from "@/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatAmd } from "@/lib/catalog";
import { addMonths, dateWords, isMonth, monthTitle, todayInYerevan, DIFFICULTY_COLORS } from "@/lib/calendar";
import { getMonthlyReport, REPORT_SOURCES, type SourceCounts } from "@/lib/report/data";
import { reportItemsFor, type ReportItem } from "@/lib/report/items";

const SOURCE_NAMES: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp", viber: "Viber", telegram: "Telegram" };

// The club's month in numbers. Which lines appear is set by the plan and,
// for a single club, by an admin; the plan's monthly_report switches the
// whole page.
export default async function ClubReportPage({ searchParams }: { searchParams: { month?: string } }) {
  const mine = await getMyClub();
  if (!mine) redirect("/login");
  const { club, limits } = mine;
  const t = await getT();
  if (!limits.config.monthly_report) {
    return (
      <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
        {t("report.notInPlan")}{" "}
        <Link href="/dashboard/packages" className="font-semibold text-terracotta-700 underline dark:text-terracotta-300">{t("clubPage.upgrade")}</Link>
      </p>
    );
  }

  const fmt = await getFormatDate();
  const words = dateWords(t);
  const thisMonth = todayInYerevan().slice(0, 7);
  // Opens on the last finished month; the running month can be looked at too.
  const month = isMonth(searchParams.month) && searchParams.month <= thisMonth ? searchParams.month : addMonths(thisMonth, -1);

  const { data: planRow } = limits.pkg ? await createAdminClient().from("packages").select("report_items").eq("id", limits.pkg).maybeSingle() : { data: null };
  const shown = new Set<ReportItem>(reportItemsFor(club.report_items, (planRow as { report_items?: unknown } | null)?.report_items));
  const has = (k: ReportItem) => shown.has(k);
  const report = await getMonthlyReport(club.id, month);
  const { totals } = report;

  const sourceText = (s: SourceCounts) =>
    REPORT_SOURCES.filter((k) => s[k] > 0)
      .map((k) => `${s[k]} — ${k === "culmen" ? "Culmen" : k === "link" ? t("report.sourceLink") : SOURCE_NAMES[k]}`)
      .join(", ") || "—";

  const cards: [ReportItem, string, string, string?][] = [
    ["hikes_total", t("report.hikes_total"), String(totals.hikes)],
    ["overnight", t("report.overnight"), String(totals.overnight)],
    ["bookings_total", t("report.bookings_total"), String(totals.booked)],
    ["cancellations", t("report.cancellations"), String(totals.cancelled)],
    ["attendance", t("report.attendance"), `${totals.came} / ${totals.absent}`, totals.unmarked > 0 ? t("report.unmarked", { count: totals.unmarked }) : undefined],
    ["revenue", t("report.revenue"), formatAmd(totals.revenue), t("report.revenueHint")],
    ["followers", t("report.followers"), String(totals.followers), t("report.followersNew", { count: totals.newFollowers })],
    ["comments", t("report.comments"), String(totals.comments)],
    ["rating", t("report.rating"), totals.rating ? `${totals.rating.average.toFixed(1)}` : "—", totals.rating ? t("report.ratingCount", { count: totals.rating.count }) : undefined],
  ];
  const visibleCards = cards.filter(([k]) => has(k));

  const columns: [ReportItem, string][] = [
    ["t_region", t("report.t_region")],
    ["t_difficulty", t("report.t_difficulty")],
    ["t_overnight", t("report.t_overnight")],
    ["t_booked", t("report.t_booked")],
    ["t_came", t("report.t_came")],
    ["t_absent", t("report.t_absent")],
    ["t_cancelled", t("report.t_cancelled")],
    ["t_sources", t("report.t_sources")],
    ["t_price", t("report.t_price")],
    ["t_revenue", t("report.t_revenue")],
  ];
  const visibleColumns = columns.filter(([k]) => has(k));
  const round = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-lg leading-none text-ink hover:border-spruce-500";
  const th = "whitespace-nowrap px-3 py-2.5 font-semibold";
  const td = "whitespace-nowrap px-3 py-2.5";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/dashboard/report?month=${addMonths(month, -1)}`} aria-label={t("calendar.prevMonth")} className={round}>‹</Link>
        {month < thisMonth ? (
          <Link href={`/dashboard/report?month=${addMonths(month, 1)}`} aria-label={t("calendar.nextMonth")} className={round}>›</Link>
        ) : (
          <span className={`${round} cursor-not-allowed opacity-40`} aria-hidden="true">›</span>
        )}
        <h2 className="font-serif text-xl font-semibold text-heading">{monthTitle(month, words)}</h2>
        {month === thisMonth && <span className="rounded-full bg-apricot-100 px-2.5 py-1 text-xs font-semibold text-apricot-700">{t("report.running")}</span>}
      </div>

      {visibleCards.length > 0 && (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map(([key, label, value, note]) => (
            <div key={key} className="rounded-xl border border-line bg-surface p-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 font-serif text-2xl font-semibold text-heading">{value}</dd>
              {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
            </div>
          ))}
        </dl>
      )}

      {(has("regions") || has("sources")) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {has("regions") && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <h3 className="text-sm text-muted">{t("report.regions")}</h3>
              <p className="mt-1.5 text-ink">{totals.regions.map((r) => t(`region.${r}`)).join(", ") || "—"}</p>
            </div>
          )}
          {has("sources") && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <h3 className="text-sm text-muted">{t("report.sources")}</h3>
              <p className="mt-1.5 text-ink">{totals.booked > 0 ? `${totals.booked} · ${sourceText(totals.sources)}` : "—"}</p>
            </div>
          )}
        </div>
      )}

      {has("hikes_table") && (
        <section>
          <h3 className="mb-2 font-serif text-lg font-semibold text-heading">{t("report.hikes_table")}</h3>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className={th}>{t("report.t_hike")}</th>
                  <th className={th}>{t("report.t_date")}</th>
                  {visibleColumns.map(([k, label]) => (
                    <th key={k} className={`${th} ${k === "t_region" || k === "t_sources" ? "" : "text-center"}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.hikes.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + 2} className="px-4 py-8 text-center text-muted">{t("report.empty")}</td>
                  </tr>
                )}
                {report.hikes.map((h) => (
                  <tr key={h.id} className="border-b border-line last:border-0">
                    <td className={`${td} font-medium text-ink`}>
                      <span className="block max-w-[16rem] truncate" title={h.title}>{h.title}</span>
                    </td>
                    <td className={`${td} text-muted`}>{fmt(h.date, "short")}</td>
                    {visibleColumns.map(([k]) => (
                      <td key={k} className={`${td} ${k === "t_region" || k === "t_sources" ? "text-muted" : "text-center text-ink"}`}>
                        {k === "t_region" ? (
                          <span className="block max-w-[12rem] truncate" title={h.regions.map((r) => t(`region.${r}`)).join(", ")}>{h.regions.map((r) => t(`region.${r}`)).join(", ")}</span>
                        ) : k === "t_difficulty" ? (
                          <span className="rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: DIFFICULTY_COLORS[h.difficulty].bg, color: DIFFICULTY_COLORS[h.difficulty].text }}>
                            {t(`difficulty.${h.difficulty}`)}
                          </span>
                        ) : k === "t_overnight" ? (
                          h.overnight ? t("tour.yes") : t("tour.no")
                        ) : k === "t_booked" ? (
                          h.booked
                        ) : k === "t_came" ? (
                          h.came
                        ) : k === "t_absent" ? (
                          h.absent
                        ) : k === "t_cancelled" ? (
                          h.cancelled
                        ) : k === "t_sources" ? (
                          sourceText(h.sources)
                        ) : k === "t_price" ? (
                          h.price > 0 ? formatAmd(h.price) : t("common.free")
                        ) : (
                          formatAmd(h.revenue)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {visibleCards.length === 0 && !has("hikes_table") && !has("regions") && !has("sources") && (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("report.nothing")}</p>
      )}
      <p className="text-xs text-muted">{t("report.note")}</p>
    </div>
  );
}
