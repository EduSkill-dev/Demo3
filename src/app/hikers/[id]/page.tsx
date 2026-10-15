import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPassport, getPublicHikers } from "@/lib/hikers";
import { getT } from "@/i18n/server";
import PassportView, { HikerAvatar } from "@/components/hikers/PassportView";
import BackLink from "@/components/ui/BackLink";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findHiker(id: string) {
  return UUID.test(id) ? (await getPublicHikers()).find((h) => h.id === id) ?? null : null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const hiker = await findHiker(params.id);
  if (!hiker) return {};
  const t = await getT();
  return { title: `${hiker.name} · ${t("hikersPage.passport")}` };
}

// One hiker's passport — only for someone who shows it.
export default async function HikerPage({ params }: { params: { id: string } }) {
  const hiker = await findHiker(params.id);
  if (!hiker) notFound();
  const [t, passport] = await Promise.all([getT(), getPassport(hiker.id)]);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Back to wherever they came from (the Hikers list, or one's own account). */}
      <BackLink fallback="/hikers" label={t("common.back")} className="text-sm font-semibold text-muted hover:text-terracotta-700" />
      <div className="mt-4 flex items-center gap-5">
        <HikerAvatar name={hiker.name} photo={hiker.photo} size="lg" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-terracotta-700 dark:text-terracotta-300">{t("hikersPage.passport")}</p>
          <h1 className="mt-1 truncate text-[30px] font-bold leading-tight text-heading">{hiker.name}</h1>
        </div>
      </div>
      <div className="mt-6">
        <PassportView passport={passport} hikes={hiker.hikes} t={t} />
      </div>
    </main>
  );
}
