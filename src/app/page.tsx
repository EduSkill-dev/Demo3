import Link from "next/link";
import { getPublicTours } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import TourGrid from "@/components/tour/TourGrid";

export default async function HomePage() {
  const t = await getT();
  const tours = (await getPublicTours()).slice(0, 6);

  return (
    <main>
      <section
        className="relative flex min-h-[420px] items-center justify-center bg-pine bg-cover bg-center"
        style={{ backgroundImage: "url('/images/ararat-hero.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center text-white">
          <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">{t("home.heroTitle")}</h1>
          <p className="mt-4 text-lg text-white/90">{t("home.heroText")}</p>
          <Link href="/tours" className="mt-8 inline-block rounded-lg bg-apricot px-6 py-3 font-semibold text-white hover:bg-apricot-dark">
            {t("home.heroCta")}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold text-heading">{t("home.upcoming")}</h2>
          <Link href="/tours" className="text-sm font-semibold text-apricot hover:text-apricot-dark">
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
