// Clubs' social pages and the passport's own words: the same rules the
// database enforces (migration 0062), so the form can warn while one types.
// Safe to import from client components.

export const SOCIAL_NETS = ["instagram", "facebook", "linkedin"] as const;
export type SocialNet = (typeof SOCIAL_NETS)[number];

const RULES: Record<SocialNet, RegExp> = {
  instagram: /^https:\/\/(www\.)?instagram\.com\/[a-z0-9._]{1,30}\/?$/i,
  facebook: /^https:\/\/(www\.|m\.|web\.)?(facebook|fb)\.com\/\S+$/i,
  linkedin: /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(company|in|school|showcase)\/[^\s/?#]+\/?$/i,
};

export const SOCIAL_NAMES: Record<SocialNet, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn" };
export const SOCIAL_EXAMPLES: Record<SocialNet, string> = {
  instagram: "https://instagram.com/club",
  facebook: "https://facebook.com/club",
  linkedin: "https://linkedin.com/company/club",
};

// What people paste: "instagram.com/x", "@x" (Instagram), "http://…" — made
// into the one form that is stored.
export function normalizeSocial(net: SocialNet, raw: string): string {
  let v = raw.trim();
  if (!v) return "";
  if (net === "instagram" && /^@?[a-z0-9._]{1,30}$/i.test(v)) v = `https://instagram.com/${v.replace(/^@/, "")}`;
  if (!/^[a-z]+:\/\//i.test(v)) v = `https://${v}`;
  return v.replace(/^http:\/\//i, "https://");
}

// "" is fine (no page); otherwise it must be a page of that network.
export const socialOk = (net: SocialNet, url: string) => !url || RULES[net].test(url);

/* -------------------------------------------------------------- passport */

export const BIO_MAX = 300;
const LINKISH = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|am|ru|net|org|io|me|info|biz|co|app|link|site|online|shop)(\s|\/|$)|[^\s@]+@[^\s@]+\.[a-z]{2,})/i;
const PHONE = /\+?\d[\d\s()-]{7,}\d/;

// Why a passport text cannot be saved, or null.
export function bioProblem(text: string): "long" | "link" | "phone" | null {
  if (text.length > BIO_MAX) return "long";
  if (LINKISH.test(text)) return "link";
  if (PHONE.test(text)) return "phone";
  return null;
}
