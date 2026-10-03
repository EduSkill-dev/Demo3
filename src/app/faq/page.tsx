import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import FaqAccordion, { type FaqItem } from "@/components/FaqAccordion";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t("faq.label")} | Highland`, description: t("faq.metaDescription") };
}

const COUNT = 7;

export default async function FaqPage() {
  const t = await getT();
  const cards = [
    { title: t("faq.card1Title"), text: t("faq.card1Text") },
    { title: t("faq.card2Title"), text: t("faq.card2Text") },
  ];
  const faqs: FaqItem[] = Array.from({ length: COUNT }, (_, i) => ({
    question: t(`faq.q${i + 1}`),
    answer: t(`faq.a${i + 1}`),
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-apricot">{t("faq.label")}</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-heading sm:text-4xl">{t("faq.title")}</h1>
      <p className="mt-3 text-muted">{t("faq.intro")}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold text-heading">{c.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{c.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <FaqAccordion items={faqs} />
      </div>
    </main>
  );
}
