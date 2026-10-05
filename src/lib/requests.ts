// Custom tour requests: shared shapes and rules (safe on the server and in
// client components — no secrets here).

export type RequestStatus = "open" | "accepted" | "closed";
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";

// A request as the screens show it: sights already turned into names.
export type RequestView = {
  id: string;
  authorName: string;
  people: number;
  dateFrom: string;
  dateTo: string;
  regions: string[];
  terrains: string[];
  sights: string[];
  overnight: boolean;
  budget: number | null; // AMD per person
  note: string | null;
  status: RequestStatus;
  createdAt: string;
};

export type OfferView = {
  id: string;
  price: number; // AMD per person
  date: string;
  message: string | null;
  status: OfferStatus;
  createdAt: string;
};

export type RequestRow = {
  id: string;
  author_name: string;
  people: number;
  date_from: string;
  date_to: string;
  regions: string[];
  terrains: string[];
  sight_ids: string[];
  overnight: boolean;
  budget: number | null;
  note: string | null;
  status: RequestStatus;
  created_at: string;
};
export const REQUEST_COLUMNS =
  "id, author_name, people, date_from, date_to, regions, terrains, sight_ids, overnight, budget, note, status, created_at";

export function toRequestView(r: RequestRow, sightNames: Map<string, string>): RequestView {
  return {
    id: r.id,
    authorName: r.author_name,
    people: r.people,
    dateFrom: r.date_from,
    dateTo: r.date_to,
    regions: r.regions ?? [],
    terrains: r.terrains ?? [],
    sights: (r.sight_ids ?? []).map((id) => sightNames.get(id)).filter((n): n is string => !!n),
    overnight: r.overnight,
    budget: r.budget,
    note: r.note,
    status: r.status,
    createdAt: r.created_at,
  };
}

export type OfferRow = { id: string; price: number; date: string; message: string | null; status: OfferStatus; created_at: string };
export const toOfferView = (o: OfferRow): OfferView => ({
  id: o.id,
  price: o.price,
  date: o.date,
  message: o.message,
  status: o.status,
  createdAt: o.created_at,
});

export const MAX_OPEN_REQUESTS = 3; // per person, so the list stays real

// A request's free text must not carry ways to reach the author: contacts
// open only once an offer is accepted. This catches the usual forms (phone
// numbers, emails, links, @handles, messenger names); it cannot catch a
// number spelled out in words.
export function hasContactDetails(text: string): boolean {
  const t = text.toLowerCase();
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/.test(t)) return true; // email
  if (/(^|\s)@[\w.]{3,}/.test(t)) return true; // @handle
  if (/https?:\/\/|www\.|\b[\w-]+\.(com|am|ru|net|org|me|io|info)\b/.test(t)) return true; // link
  if (/telegram|whatsapp|viber|instagram|facebook|t\.me|wa\.me|տելեգրամ|վայբեր|վացապ|վատսապ|ինստագրամ|ինստա|ֆեյսբուք|телеграм|вайбер|ватсап|вацап|инстаграм|фейсбук/.test(t)) {
    return true;
  }
  // Phone: eight or more digits in a row once dates like 15.10.2026 are set aside.
  const withoutDates = t.replace(/\b\d{1,4}[./-]\d{1,2}[./-]\d{1,4}\b/g, " ");
  return /(?:\d[\s\-().]*){8,}/.test(withoutDates);
}
