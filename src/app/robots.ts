import type { MetadataRoute } from "next";

// Search engines may read the public pages; the private areas, the API and
// one-time links are left out.
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://bolbol.am").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/account", "/api/", "/auth/", "/receipts/", "/login", "/register", "/newsletter/", "/contact/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
