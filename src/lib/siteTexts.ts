// Server-only: the texts admins changed (site_texts), laid over the built-in
// dictionaries by makeT. Cached; /api/admin clears the tag after a save.
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Locale } from "@/i18n/config";
import type { Overrides } from "@/i18n/translate";

export const SITE_TEXTS_TAG = "site-texts";

export const getSiteTexts = unstable_cache(
  async (locale: Locale): Promise<Overrides> => {
    try {
      const { data } = await createAdminClient().from("site_texts").select("key, value").eq("locale", locale);
      return Object.fromEntries(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
    } catch {
      return {};
    }
  },
  ["site-texts"],
  { tags: [SITE_TEXTS_TAG], revalidate: 300 }
);
