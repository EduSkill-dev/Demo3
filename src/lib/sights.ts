// Server-only: the platform's list of sights (table `sights`), cached. Admins
// change it at /admin/sights, which clears the tag.
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/i18n/server";
import type { Locale } from "@/i18n/config";

export const SIGHTS_TAG = "sights";

export type Sight = { id: string; name_hy: string; name_ru: string; name_en: string; region: string; active: boolean };

const loadSights = unstable_cache(
  async (): Promise<Sight[]> => {
    try {
      const { data } = await createAdminClient()
        .from("sights")
        .select("id, name_hy, name_ru, name_en, region, active")
        .order("name_hy");
      return (data ?? []) as Sight[];
    } catch {
      return [];
    }
  },
  ["sights"],
  { tags: [SIGHTS_TAG], revalidate: 300 }
);

export const getAllSights = () => loadSights();

const nameIn = (s: Sight, locale: Locale) => (locale === "ru" ? s.name_ru : locale === "en" ? s.name_en : s.name_hy) || s.name_hy;

// id → name in the reader's language (hidden sights included: old listings
// and requests keep showing what they ticked).
export async function getSightNames(): Promise<Map<string, string>> {
  const [sights, locale] = await Promise.all([loadSights(), getLocale()]);
  return new Map(sights.map((s) => [s.id, nameIn(s, locale)]));
}

// What the pickers offer: the active sights, named in the reader's language.
export async function getSightOptions(): Promise<{ id: string; name: string; region: string }[]> {
  const [sights, locale] = await Promise.all([loadSights(), getLocale()]);
  return sights
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: nameIn(s, locale), region: s.region }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
