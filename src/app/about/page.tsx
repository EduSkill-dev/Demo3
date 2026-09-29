import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Մեր մասին | Highland",
  description:
    "Highland-ը միավորում է Հայաստանի արշավական ակումբներին, նրանց միջոցառումներն ու բնությունը սիրող մարդկանց։",
};

const numberFormat = new Intl.NumberFormat("hy-AM");
function formatCount(value: number | null | undefined) {
  return value == null ? "—" : numberFormat.format(value);
}

export default async function AboutPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_about_stats");
  const counts = Array.isArray(data) ? data[0] : null;

  const stats = [
    { value: formatCount(counts?.clubs_count), label: "արշավական ակումբ" },
    { value: formatCount(counts?.users_count), label: "գրանցված օգտատեր" },
    { value: formatCount(counts?.tours_count), label: "արշավ հարթակում" },
  ];

  const pillars = [
    {
      title: "Ակումբներն ու իրենց ծրագրերը",
      text: "Ակումբների միջոցառումներն ու օրակարգը՝ մեկ տեղում, որպեսզի մասնակիցները հստակ տեսնեն՝ ով, ուր և երբ է արշավ կազմակերպում։",
    },
    {
      title: "Գտիր քեզ համապատասխան արշավը",
      text: "Փնտրիր ըստ ամսաթվի, վայրի, մարզի, ակումբի և տեսակի։",
    },
    {
      title: "Կապ՝ բնության շուրջ",
      text: "Մոտեցնելով բնությունը սիրող մարդկանց ու արշավականներին՝ նպաստում ենք ավելի ակտիվ արշավային համայնքի ձևավորմանը։",
    },
  ];

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-pine text-white">
        <div className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-6 -top-10 h-72 w-72 rounded-full border border-white/10" />
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-apricot">
            Highland
          </p>
          <h1 className="mt-4 max-w-2xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">
            Հայաստանի արշավային կյանքը՝ մեկ հարթակում
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-7 text-white/80">
            Ստեղծում ենք բաց ու վստահելի միջավայր, որտեղ հայկական արշավական
            ակումբները տեսանելի են, իսկ յուրաքանչյուրը կարող է գտնել իրեն
            հարմար արշավը։
          </p>
          <Link
            href="/tours"
            className="mt-8 inline-flex rounded-lg bg-apricot px-5 py-3 text-sm font-semibold text-white transition hover:bg-apricot-dark"
          >
            Փնտրել արշավ
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-sand bg-white">
        <div className="mx-auto grid max-w-5xl divide-y divide-sand px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-3 py-6 sm:flex-col sm:items-start sm:gap-1">
              <span className="font-serif text-3xl font-semibold text-pine">{s.value}</span>
              <span className="text-sm text-neutral-500">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-apricot">
              Ինչու Highland
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-pine">
              Արշավային համայնքը արժանի է միասնական հարթակի
            </h2>
          </div>
          <p className="text-base leading-8 text-neutral-600">
            Highland-ը մեկ վայրում ներկայացնում է հայկական արշավական
            ակումբներին, նրանց առաջիկա միջոցառումներն ու օրակարգը։ Մեր
            նպատակն է արշավների մասին տեղեկությունը դարձնել հասանելի ու
            թափանցիկ, իսկ ակումբների և բնությունը սիրող մարդկանց միջև՝ կենդանի
            կապ ստեղծել։
          </p>
        </div>

        <div className="mt-14 grid gap-8 border-t border-sand pt-10 md:grid-cols-3">
          {pillars.map((p) => (
            <article key={p.title}>
              <div className="h-1 w-10 rounded-full bg-apricot" />
              <h3 className="mt-4 font-serif text-xl font-semibold text-pine">{p.title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-6 mb-16 rounded-2xl bg-sand px-6 py-10 sm:mx-auto sm:max-w-5xl sm:px-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-2xl font-semibold text-pine">
              Հաջորդ արշավդ սկսվում է այստեղից
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Բացահայտիր ակումբների միջոցառումները և միացի՛ր հարթակին։
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tours" className="rounded-lg bg-pine px-5 py-3 text-sm font-semibold text-white hover:bg-pine-dark">
              Գտնել արշավ
            </Link>
            <Link href="/register" className="rounded-lg border border-pine/25 px-5 py-3 text-sm font-semibold text-pine hover:bg-white">
              Միանալ Highland-ին
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
