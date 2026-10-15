import type { MetadataRoute } from "next";

// Search engines may read the public pages; the private areas, the API,
// one-time links, the calendar and filtered views of the Tours page (an
// endless set of addresses with the same hikes) are left out.
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://bolbol.am").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/account", "/api/", "/auth/", "/receipts/", "/login", "/register", "/newsletter/", "/contact/", "/calendar", "/tours?"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
