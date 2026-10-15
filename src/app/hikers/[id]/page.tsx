import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPassport, getPublicHikers } from "@/lib/hikers";
import { getT } from "@/i18n/server";
import PassportView, { HikerAvatar, PassportStats } from "@/components/hikers/PassportView";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import ClearBioButton from "@/components/admin/ClearBioButton";
import BackLink from "@/components/BackLink";

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
  const [t, passport, { data: bioRow }, admin] = await Promise.all([
    getT(),
    getPassport(hiker.id),
    createAdminClient().from("profiles").select("passport_bio").eq("id", hiker.id).maybeSingle(),
    getAdmin(),
  ]);
  const bio = ((bioRow as { passport_bio?: string | null } | null)?.passport_bio ?? "").trim();
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Back to wherever they came from (the Hikers list, or one's own account). */}
      <BackLink fallback="/hikers" label={t("common.back")} />
      <div className="mt-4 grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-stretch">
        <div>
          <div className="flex items-center gap-5">
            <HikerAvatar name={hiker.name} photo={hiker.photo} size="lg" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-terracotta-700 dark:text-terracotta-300">{t("hikersPage.passport")}</p>
              <h1 className="mt-1 truncate text-[30px] font-bold leading-tight text-heading">{hiker.name}</h1>
            </div>
          </div>
          <div className="mt-4">
            <PassportStats passport={passport} hikes={hiker.hikes} t={t} />
          </div>
        </div>
        {/* Their own words (if they wrote any). */}
        {bio && (
          <blockquote className="relative flex flex-col justify-center rounded-3xl border border-line bg-surface px-6 py-5 lg:ml-6">
            <span className="absolute -top-3 left-5 font-serif text-5xl leading-none text-apricot-500" aria-hidden="true">“</span>
            <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-ink">{bio}</p>
            {admin && can(admin, "individuals") && <ClearBioButton userId={hiker.id} name={hiker.name} />}
          </blockquote>
        )}
      </div>
      <div className="mt-8">
        <PassportView passport={passport} hikes={hiker.hikes} t={t} stats={false} />
      </div>
    </main>
  );
}
