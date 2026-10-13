// The lines a club's monthly report can contain. Which of them a club
// actually sees is decided by its plan's default list and, on top of that,
// by an admin for that club alone (packages.report_items, clubs.report_items).
// Labels here are for the admin screens (Armenian); the club's own page takes
// its texts from the dictionary (report.<key>). Safe to import anywhere.

export const REPORT_GROUPS = {
  summary: "Ամսվա ընդհանուր թվերը",
  table: "Արշավների ցանկի սյունակները",
} as const;
export type ReportGroup = keyof typeof REPORT_GROUPS;

export const REPORT_ITEMS = [
  { key: "hikes_total", group: "summary", label: "Արշավների թիվը" },
  { key: "regions", group: "summary", label: "Այցելած մարզերը" },
  { key: "overnight", group: "summary", label: "Գիշերակացով արշավների թիվը" },
  { key: "bookings_total", group: "summary", label: "Ամրագրումների թիվը" },
  { key: "sources", group: "summary", label: "Որտեղից են եկել ամրագրումները (Culmen, սոց. ցանցեր)" },
  { key: "cancellations", group: "summary", label: "Չեղարկումների թիվը" },
  { key: "attendance", group: "summary", label: "Եկածների և չեկածների թիվը" },
  { key: "revenue", group: "summary", label: "Ընդհանուր գումարը" },
  { key: "followers", group: "summary", label: "Հետևորդներ (ընդհանուր և այս ամիս)" },
  { key: "comments", group: "summary", label: "Ստացած մեկնաբանություններ" },
  { key: "rating", group: "summary", label: "Վարկանիշը ամսվա վերջին և գնահատողների թիվը" },
  { key: "hikes_table", group: "table", label: "Ցույց տալ արշավների ցանկը" },
  { key: "t_region", group: "table", label: "Մարզ" },
  { key: "t_difficulty", group: "table", label: "Բարդություն" },
  { key: "t_overnight", group: "table", label: "Գիշերակաց" },
  { key: "t_booked", group: "table", label: "Ամրագրածներ" },
  { key: "t_came", group: "table", label: "Եկածներ" },
  { key: "t_absent", group: "table", label: "Չեկածներ" },
  { key: "t_cancelled", group: "table", label: "Չեղարկածներ" },
  { key: "t_sources", group: "table", label: "Որտեղից են եկել" },
  { key: "t_price", group: "table", label: "Գին" },
  { key: "t_revenue", group: "table", label: "Գումար" },
] as const satisfies readonly { key: string; group: ReportGroup; label: string }[];

export type ReportItem = (typeof REPORT_ITEMS)[number]["key"];
export const REPORT_KEYS = REPORT_ITEMS.map((i) => i.key) as ReportItem[];

// Known keys only, in the registry's order. null / not a list = everything.
export function cleanReportItems(raw: unknown): ReportItem[] | null {
  if (!Array.isArray(raw)) return null;
  return REPORT_KEYS.filter((k) => (raw as unknown[]).includes(k));
}

// What a club sees: its own list if an admin set one, else its plan's
// default, else every line.
export function reportItemsFor(clubItems: unknown, planItems: unknown): ReportItem[] {
  return cleanReportItems(clubItems) ?? cleanReportItems(planItems) ?? REPORT_KEYS;
}
