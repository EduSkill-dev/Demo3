// Shared by the server (adminEvents.ts) and the admin list (client).
export type AdminEvent = { id: number; kind: string; title: string; link: string | null; created_at: string };

// Kind → a short label and an icon for the list.
export const EVENT_KINDS: Record<string, { label: string; icon: string }> = {
  "individual.new": { label: "Նոր գրանցում", icon: "🥾" },
  "club.new": { label: "Նոր ակումբ", icon: "🏕️" },
  "payment.subscription": { label: "Փաթեթի վճարում", icon: "💳" },
  "newsletter.new": { label: "Նոր բաժանորդ", icon: "📰" },
  "suggestion.new": { label: "Առաջարկ", icon: "💡" },
  "suggestion.reply": { label: "Պատասխան առաջարկին", icon: "↩️" },
  "support.new": { label: "Օգնության չաթ", icon: "💬" },
  "request.new": { label: "Անհատական հայտ", icon: "📝" },
  "tour.new": { label: "Նոր հայտարարություն", icon: "⛰️" },
  "rating.new": { label: "Գնահատական", icon: "⭐" },
};
