import Link from "next/link";
import { getPublicTours } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import { getViewer } from "@/lib/viewer";
import { getSpotlight } from "@/lib/spotlight";
import TourGrid from "@/components/tour/TourGrid";
import CustomTourCta from "@/components/requests/CustomTourCta";

export default async function HomePage() {
  const t = await getT();
  const [spotlight, all, viewer] = await Promise.all([getSpotlight(), getPublicTours(), getViewer()]);
  const tours = all.slice(0, 6);
  // "Wait for a hike" = a saved search (individuals; visitors sign in first).
  const waitHref = viewer?.role === "individual" ? "/account/searches" : !viewer ? `/login?next=${encodeURIComponent("/account/searches")}` : null;
  const customHref = viewer?.role === "individual" ? "/account/requests/new" : "/requests/new";
  const ghost = "inline-flex items-center gap-2 rounded-full border-2 border-card/70 px-5 py-2.5 font-bold text-card transition hover:bg-card hover:text-spruce-900";

  return (
    <main>
      <section className="bg-spruce-500 text-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <h1 className="text-[44px] font-bold leading-[1.1] sm:text-[52px]">{t("home.heroTitle")}</h1>
            <p className="mt-5 max-w-xl text-xl font-semibold leading-snug text-apricot-300">{t("home.heroText")}</p>

            {/* Three ways in. The hikes themselves are listed below. */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/places" className="inline-flex items-center gap-2 rounded-full bg-apricot-500 px-5 py-2.5 font-bold text-spruce-900 transition hover:bg-apricot-300">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                {t("home.heroPlaces")}
              </Link>
              {waitHref && (
                <Link href={waitHref} className={ghost}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {t("home.heroWait")}
                </Link>
              )}
              <Link href={customHref} className={ghost}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
                {t("home.heroCustom")}
              </Link>
            </div>
            {waitHref && <p className="mt-4 max-w-xl text-sm text-card/75">{t("home.heroWaitHint")}</p>}
          </div>

          {/* Who was most active: the hiker of the quarter, and under it the
              club of the month (see src/lib/spotlight.ts). */}
          <div className="space-y-4">
            <article className="flex items-center gap-5 rounded-[28px] bg-card p-4 text-spruce-900 shadow-xl">
              {spotlight.hiker?.photo ? (
                <img src={spotlight.hiker.photo} alt={spotlight.hiker.name} className="h-36 w-36 shrink-0 rounded-[20px] object-cover sm:h-52 sm:w-52" />
              ) : (
                <span className="flex h-36 w-36 shrink-0 items-center justify-center rounded-[20px] bg-spruce-100 text-spruce-700 sm:h-52 sm:w-52" aria-hidden="true">
                  <svg viewBox="0 0 32 32" className="h-16 w-16 sm:h-24 sm:w-24" fill="currentColor">
                    <path d="M13 7 3 26h12Z" opacity=".55" />
                    <path d="M20 12 11 26h18Z" />
                  </svg>
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-snug text-terracotta-500">
                  🏅 {t("home.hikerLabel")}
                </p>
                {spotlight.hiker ? (
                  <>
                    <p className="mt-2 text-2xl font-bold leading-tight sm:text-[26px]">{spotlight.hiker.name}</p>
                    <p className="mt-2 text-sm text-[#5B6B66]">{t("home.hikerStat", { count: spotlight.hiker.hikes })}</p>
                  </>
                ) : (
                  <p className="mt-2 text-base font-semibold leading-snug text-[#5B6B66]">{t("home.hikerEmpty")}</p>
                )}
              </div>
            </article>

            <article className="flex items-center gap-5 rounded-[28px] bg-card p-4 text-spruce-900 shadow-xl">
              {spotlight.club?.photo ? (
                <img src={spotlight.club.photo} alt={spotlight.club.name} className="h-24 w-24 shrink-0 rounded-full object-contain sm:h-28 sm:w-28" />
              ) : (
                <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-spruce-100 text-spruce-700 sm:h-28 sm:w-28" aria-hidden="true">
                  <svg viewBox="0 0 32 32" className="h-12 w-12" fill="currentColor">
                    <path d="M13 7 3 26h12Z" opacity=".55" />
                    <path d="M20 12 11 26h18Z" />
                  </svg>
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-snug text-terracotta-500">
                  🏆 {t("home.clubLabel")}
                </p>
                {spotlight.club ? (
                  <>
                    <p className="mt-1.5 text-xl font-bold leading-tight">
                      <Link href={spotlight.club.href} className="hover:underline">{spotlight.club.name}</Link>
                    </p>
                    <p className="mt-1 text-sm text-[#5B6B66]">
                      {t("home.clubStat", { hikes: spotlight.club.hikes, people: spotlight.club.people })}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-base font-semibold leading-snug text-[#5B6B66]">{t("home.clubEmpty")}</p>
                )}
              </div>
            </article>
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
        <div className="mt-12">
          <CustomTourCta />
        </div>
      </section>
    </main>
  );
}
