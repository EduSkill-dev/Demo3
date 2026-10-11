import CustomTourCta from "@/components/requests/CustomTourCta";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPublicTours } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import ToursExplorer from "@/components/ToursExplorer";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getT())("toursPage.title")}` };
}

export default async function ToursPage() {
  const t = await getT();
  const supabase = await createClient();
  const [tours, { data: clubs }] = await Promise.all([
    getPublicTours(),
    supabase.from("clubs").select("id, name").order("name"),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-center font-serif text-3xl font-semibold text-heading sm:text-4xl">{t("toursPage.title")}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-muted">{t("toursPage.intro")}</p>
      <div className="mt-6 flex justify-center">
        <div className="flex rounded-full bg-sand p-1">
          <span className="flex h-9 items-center rounded-full bg-spruce-500 px-4 text-sm font-semibold text-[#FFFDF8]" aria-current="page">{t("calendar.switchList")}</span>
          <Link href="/calendar" className="flex h-9 items-center rounded-full px-4 text-sm font-semibold text-ink hover:text-terracotta-700">{t("calendar.switchCalendar")}</Link>
        </div>
      </div>
      <div className="mt-6">
        <Suspense>
          <ToursExplorer tours={tours} clubs={(clubs ?? []) as { id: string; name: string }[]} />
        </Suspense>
      </div>
      <div className="mt-12">
        <CustomTourCta />
      </div>
    </main>
  );
}
