import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { activePackage } from "@/lib/catalog";

export const dynamic = "force-dynamic";

// The list of public pages for search engines: the fixed pages, every club
// with an active plan and its published upcoming hikes.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://bolbol.am").replace(/\/$/, "");
  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/tours`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/calendar`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/clubs`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const db = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: clubs }, { data: tours }] = await Promise.all([
      db.from("clubs").select("id, slug, tariff, package_ends_at"),
      db.from("tours").select("id, club_id, created_at").eq("status", "active").eq("admin_hidden", false).gte("date", today),
    ]);
    const live = ((clubs ?? []) as { id: string; slug: string | null; tariff: string | null; package_ends_at: string | null }[]).filter((c) => activePackage(c));
    const liveIds = new Set(live.map((c) => c.id));
    return [
      ...fixed,
      ...live.map((c) => ({ url: `${base}/clubs/${c.slug ?? c.id}`, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...((tours ?? []) as { id: string; club_id: string; created_at: string }[])
        .filter((x) => liveIds.has(x.club_id))
        .map((x) => ({ url: `${base}/tours/${x.id}`, lastModified: x.created_at, changeFrequency: "daily" as const, priority: 0.8 })),
    ];
  } catch {
    return fixed;
  }
}
