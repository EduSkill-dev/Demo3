// The social networks a hike's link can be shared on. Which of them are
// switched on is the admins' decision (site_settings.share_networks, see
// lib/siteSettings); this file only knows how each one takes a link.
// Safe to import from client components.

export const SHARE_NETWORKS = [
  { id: "facebook", name: "Facebook", how: "Բացում է Facebook-ի «Կիսվել» պատուհանը՝ հղումով։ Տեքստը մարդն ինքն է գրում։" },
  { id: "instagram", name: "Instagram", how: "Instagram-ը հղումով կիսվելու պատուհան չունի․ հղումը պատճենվում է, և բացվում է Instagram-ը՝ տեղադրելու համար։" },
  { id: "whatsapp", name: "WhatsApp", how: "Բացում է WhatsApp-ը՝ պատրաստ հաղորդագրությամբ (անվանում + հղում)։" },
  { id: "viber", name: "Viber", how: "Բացում է Viber-ը՝ պատրաստ հաղորդագրությամբ։ Աշխատում է այն սարքում, որտեղ Viber-ը տեղադրված է։" },
  { id: "telegram", name: "Telegram", how: "Բացում է Telegram-ի «Կիսվել» պատուհանը՝ հղումով և անվանումով։" },
] as const;

export type ShareNetwork = (typeof SHARE_NETWORKS)[number]["id"];
export const SHARE_NETWORK_IDS = SHARE_NETWORKS.map((n) => n.id) as ShareNetwork[];

// Where the browser goes to share `url` (with a short `text`) on a network.
// Instagram has no such address: the caller copies the link and opens it.
export function shareHref(network: ShareNetwork, url: string, text: string): string {
  const u = encodeURIComponent(url);
  const both = encodeURIComponent(text ? `${text}\n${url}` : url);
  switch (network) {
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}&text=${encodeURIComponent(text)}`;
    case "whatsapp":
      return `https://wa.me/?text=${both}`;
    case "viber":
      return `viber://forward?text=${both}`;
    case "instagram":
      return "https://www.instagram.com/";
  }
}
