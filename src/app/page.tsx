import Link from "next/link";
import { getPublicTours } from "@/lib/publicTours";
import { getLocale, getT } from "@/i18n/server";
import { getViewer } from "@/lib/viewer";
import { getSpotlight } from "@/lib/spotlight";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatNumber } from "@/i18n/dates";
import SignUpFirstButton from "@/components/home/SignUpFirstButton";

// The platform's numbers: hikes to come and held, people signed up, clubs.
async function getHomeStats() {
  try {
    const db = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data }, { count: past }] = await Promise.all([
      db.rpc("get_about_stats"),
      db.from("tours").select("id", { count: "exact", head: true }).eq("status", "active").eq("admin_hidden", false).lt("date", today),
    ]);
    const c = (Array.isArray(data) ? data[0] : null) as { clubs_count?: number; users_count?: number } | null;
    return { past: past ?? null, users: c?.users_count ?? null, clubs: c?.clubs_count ?? null };
  } catch {
    return { past: null, users: null, clubs: null };
  }
}

const ICONS = {
  hikes: "M3 20l6-10 4 6 2-3 6 7H3zM15 5a2 2 0 1 0 4 0 2 2 0 0 0-4 0",
  places: "M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  wait: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  custom: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
};

// The home page: who is most active, the numbers, and the four ways to use
// the platform — each a card with its buttons.
export default async function HomePage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const [spotlight, all, viewer, counts] = await Promise.all([getSpotlight(), getPublicTours(), getViewer(), getHomeStats()]);
  const num = (v: number | null) => (v === null ? "—" : formatNumber(v, locale));
  const stats = [
    { value: num(all.length), label: t("home.statUpcoming") },
    { value: num(counts.past), label: t("home.statPast") },
    { value: num(counts.users), label: t("home.statUsers") },
    { value: num(counts.clubs), label: t("home.statClubs") },
  ];
  const primary = "inline-flex items-center rounded-full bg-spruce-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-spruce-900";
  const secondary =
    "inline-flex items-center rounded-full border-2 border-spruce-900 px-5 py-2 text-sm font-semibold text-spruce-900 transition hover:bg-spruce-900 hover:text-card dark:border-ink dark:text-ink dark:hover:bg-ink dark:hover:text-spruce-900";
  const individual = viewer?.role === "individual";
  const ways = [
    {
      key: "Hikes", icon: ICONS.hikes, tint: "#DCEBE6", ink: "#14443B",
      actions: (
        <>
          <Link href="/tours" className={primary}>{t("home.wayHikesList")}</Link>
          <Link href="/calendar" className={secondary}>{t("home.wayHikesCalendar")}</Link>
        </>
      ),
    },
    {
      key: "Places", icon: ICONS.places, tint: "#FCEBC4", ink: "#6B4800",
      actions: <Link href="/places" className={primary}>{t("home.wayPlacesButton")}</Link>,
    },
    {
      key: "Wait", icon: ICONS.wait, tint: "#F9DFD2", ink: "#8F2F10",
      actions:
        !viewer || individual ? (
          <SignUpFirstButton href="/account/searches" signedIn={individual} label={t("home.wayWaitButton")} className={primary} />
        ) : (
          <span className="text-sm text-muted">{t("home.forIndividuals")}</span>
        ),
    },
    {
      key: "Custom", icon: ICONS.custom, tint: "#DCEBE6", ink: "#14443B",
      actions:
        !viewer || individual ? (
          <Link href={individual ? "/account/requests/new" : "/requests/new"} className={primary}>{t("home.wayCustomButton")}</Link>
        ) : (
          <span className="text-sm text-muted">{t("home.forIndividuals")}</span>
        ),
    },
  ];

  return (
    <main>
      <section className="bg-spruce-500 text-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-20">
          <div>
            <h1 className="text-[44px] font-bold leading-[1.1] sm:text-[52px]">{t("home.heroTitle")}</h1>
            <p className="mt-5 max-w-xl text-xl font-semibold leading-snug text-apricot-300">{t("home.heroText")}</p>

            <p className="mt-4 max-w-xl text-lg text-card/85">{t("home.heroSub")}</p>
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

      {/* ---------- The platform in numbers, over the hero's edge ---------- */}
      <section className="relative z-10 mx-auto -mt-10 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 overflow-hidden rounded-[28px] border border-line bg-surface shadow-xl lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-col items-center gap-1 px-4 py-6 text-center ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
            >
              <span className="text-[34px] font-bold leading-none text-heading">{s.value}</span>
              <span className="text-sm text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- What one can do here ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-[30px] font-bold leading-tight text-heading">{t("home.waysTitle")}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-muted">{t("home.waysIntro")}</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {ways.map((w) => (
            <article key={w.key} className="flex flex-col rounded-[28px] border border-line bg-surface p-6 shadow-sm transition hover:shadow-md">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: w.tint, color: w.ink }} aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d={w.icon} />
                  </svg>
                </span>
                <h3 className="text-[22px] font-bold leading-snug text-heading">{t(`home.way${w.key}Title`)}</h3>
              </div>
              <p className="mt-4 flex-1 leading-relaxed text-ink/85">{t(`home.way${w.key}Text`)}</p>
              <div className="mt-5 flex flex-wrap items-start gap-2">{w.actions}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
