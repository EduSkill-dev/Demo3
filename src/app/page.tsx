import { getPublicTours } from "@/lib/publicTours";
import HomeToursSection from "@/components/HomeToursSection";

export default async function HomePage() {
  const tours = await getPublicTours();

  return (
    <main>
      {/* Hero */}
      <section
        className="relative flex min-h-[420px] items-center justify-center bg-pine bg-cover bg-center"
        style={{ backgroundImage: "url('/images/ararat-hero.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center text-white">
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            Սարերը սպասում են քեզ
          </h1>
          <p className="mt-4 text-lg text-white/90">
            Գտիր քո հաջորդ արշավը՝ Արարատի հայացքի տակ, Հայաստանի բոլոր
            ակումբների հետ մեկ վայրում։
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <a
              href="#tours"
              className="rounded-lg bg-apricot px-5 py-3 font-semibold text-white"
            >
              Գտնել արշավ
            </a>
          </div>
        </div>
      </section>

      {/* Tours grid + filters */}
      <section id="tours" className="mx-auto max-w-6xl px-6 py-12">
        <HomeToursSection tours={tours} />
      </section>

    </main>
  );
}
