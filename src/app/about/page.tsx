import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getT } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t("header.about")} | Highland`, description: t("about.metaDescription") };
}

export default async function AboutPage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_about_stats");
  const counts = Array.isArray(data) ? data[0] : null;
  const fmt = (v: number | null | undefined) => (v == null ? "—" : new Intl.NumberFormat(INTL_LOCALE[locale]).format(v));

  const stats = [
    { value: fmt(counts?.clubs_count), label: t("about.statClubs") },
    { value: fmt(counts?.users_count), label: t("about.statUsers") },
    { value: fmt(counts?.tours_count), label: t("about.statTours") },
  ];
  const pillars = [
    { title: t("about.pillar1Title"), text: t("about.pillar1Text") },
    { title: t("about.pillar2Title"), text: t("about.pillar2Text") },
    { title: t("about.pillar3Title"), text: t("about.pillar3Text") },
  ];

  return (
    <main>
      <section className="relative overflow-hidden bg-pine text-white">
        <div className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-6 -top-10 h-72 w-72 rounded-full border border-white/10" />
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-apricot">Highland</p>
          <h1 className="mt-4 max-w-2xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">{t("about.heroTitle")}</h1>
          <p className="mt-5 max-w-xl text-lg leading-7 text-white/80">{t("about.heroText")}</p>
          <Link href="/tours" className="mt-8 inline-flex rounded-lg bg-apricot px-5 py-3 text-sm font-semibold text-white transition hover:bg-apricot-dark">
            {t("about.heroCta")}
          </Link>
        </div>
      </section>

      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-5xl divide-y divide-line px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-3 py-6 sm:flex-col sm:items-start sm:gap-1 sm:px-6 sm:first:pl-0">
              <span className="font-serif text-3xl font-semibold text-heading">{s.value}</span>
              <span className="text-sm text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-apricot">{t("about.whyLabel")}</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-heading">{t("about.whyTitle")}</h2>
          </div>
          <p className="text-base leading-8 text-ink">{t("about.whyText")}</p>
        </div>
        <div className="mt-14 grid gap-8 border-t border-line pt-10 md:grid-cols-3">
          {pillars.map((p) => (
            <article key={p.title}>
              <div className="h-1 w-10 rounded-full bg-apricot" />
              <h3 className="mt-4 font-serif text-xl font-semibold text-heading">{p.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-6 mb-16 rounded-2xl bg-sand px-6 py-10 sm:mx-auto sm:max-w-5xl sm:px-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-2xl font-semibold text-heading">{t("about.ctaTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("about.ctaText")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tours" className="rounded-lg bg-pine px-5 py-3 text-sm font-semibold text-white hover:bg-pine-dark">
              {t("about.ctaFind")}
            </Link>
            <Link href="/register" className="rounded-lg border border-line px-5 py-3 text-sm font-semibold text-ink hover:bg-surface">
              {t("about.ctaJoin")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
