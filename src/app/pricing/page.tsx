import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { getPlans } from "@/lib/plans/server";
import { getBusinessSettings } from "@/lib/business";
import { PACKAGE_IDS, formatAmd } from "@/lib/catalog";
import { PLAN_LINES, planHasLine } from "@/lib/plans/display";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("pricing.title"), description: t("pricing.intro") };
}

// The public price list: what is free for every club, and what Advanced adds.
// Built from the super admin's plans; a frozen plan does not show.
export default async function PricingPage() {
  const [t, plans, business] = await Promise.all([getT(), getPlans(), getBusinessSettings()]);
  const shown = PACKAGE_IDS.map((id) => plans[id]).filter((p) => p.isVisible);
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold text-heading">{t("pricing.title")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t("pricing.intro")}</p>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-4" />
              {shown.map((p) => (
                <th key={p.id} className="px-4 py-4 text-center align-top">
                  <span className="block font-serif text-lg font-semibold text-heading">{p.name}</span>
                  <span className="mt-1 block text-sm font-semibold text-terracotta-500 dark:text-terracotta-300">
                    {p.priceAmd > 0 ? t("package.perMonth", { price: formatAmd(p.priceAmd) }) : t("common.free")}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_LINES.map((line) => (
              <tr key={line.label} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink">
                  {t(line.label, { count: business.listing_limit_month })}
                  {line.soon && <span className="ml-1.5 text-xs text-muted">({t("package.soon")})</span>}
                </td>
                {shown.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-center">
                    {planHasLine(p.config, line.feature) ? (
                      <span className="font-bold text-spruce-500 dark:text-spruce-300" aria-label={t("pricing.included")}>✓</span>
                    ) : (
                      <span className="text-muted" aria-label={t("pricing.notIncluded")}>—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-muted">
        {t("pricing.commission", { percent: business.platform_fee_percent, days: business.promo_days })}
      </p>
      <Link href="/register/club" className="mt-6 inline-flex rounded-lg bg-spruce-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900">
        {t("pricing.cta")}
      </Link>
    </main>
  );
}
