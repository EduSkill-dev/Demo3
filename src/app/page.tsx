import Link from "next/link";
import { getPublicTours } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import { REGIONS } from "@/lib/catalog";
import TourGrid from "@/components/tour/TourGrid";

const field =
  "w-full rounded-xl border border-[#E6D9C2] bg-white px-3 py-2.5 text-sm text-spruce-900 focus:border-terracotta-500 focus:outline-none";

export default async function HomePage() {
  const t = await getT();
  const all = await getPublicTours();
  const tours = all.slice(0, 6);
  // The clubs that have something to book right now, for the hero's filter.
  const clubs = [...new Map(all.map((x) => [x.club.id, x.club.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <section className="bg-spruce-500 text-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <h1 className="text-[44px] font-bold leading-[1.1] sm:text-[52px]">{t("home.heroTitle")}</h1>
            <p className="mt-5 max-w-xl text-lg text-card/90">{t("home.heroText")}</p>

            {/* The search opens the Tours page with these filters applied. */}
            <form action="/tours" className="mt-8 grid gap-3 rounded-[20px] bg-card p-4 text-spruce-900 shadow-lg sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#5B6B66]">
                {t("toursPage.region")}
                <select name="region" defaultValue="" className={`${field} mt-1`}>
                  <option value="">{t("toursPage.any")}</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{t(`region.${r}`)}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-[#5B6B66]">
                {t("toursPage.from")}
                <input type="date" name="from" min={today} className={`${field} mt-1`} />
              </label>
              <label className="text-xs font-semibold text-[#5B6B66]">
                {t("toursPage.club")}
                <select name="club" defaultValue="" className={`${field} mt-1`}>
                  <option value="">{t("toursPage.any")}</option>
                  {clubs.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="self-end rounded-full bg-apricot-500 px-5 py-2.5 font-bold text-spruce-900 hover:bg-apricot-300">
                {t("home.heroCta")}
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-[28px] shadow-xl">
            <img src="/images/ararat-hero.jpg" alt="" className="h-64 w-full object-cover sm:h-80 lg:h-[26rem]" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[30px] font-bold leading-tight text-heading">{t("home.upcoming")}</h2>
          <Link href="/tours" className="text-sm font-semibold text-terracotta-500 hover:text-terracotta-700">
            {t("home.allTours")} →
          </Link>
        </div>
        <div className="mt-6">
          {tours.length === 0 ? <p className="text-muted">{t("home.noTours")}</p> : <TourGrid tours={tours} backHref="/" />}
        </div>
      </section>
    </main>
  );
}
