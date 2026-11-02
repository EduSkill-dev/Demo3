// Why a club changes a booked hike. Shared by the form, the emails and the
// admin list; the database accepts the same codes (0088_tour_changes.sql).
export const CHANGE_REASONS = {
  route: "tourChange.reasonRoute",
  date: "tourChange.reasonDate",
  departure: "tourChange.reasonDeparture",
  weather: "tourChange.reasonWeather",
  safety: "tourChange.reasonSafety",
  transport: "tourChange.reasonTransport",
  guide: "tourChange.reasonGuide",
  other: "tourChange.reasonOther",
} as const;

export type ChangeReason = keyof typeof CHANGE_REASONS;

export type TourChangeFacts = {
  date: string;
  end_date: string | null;
  overnight: boolean;
  meeting_time: string | null;
  meeting_point: string | null;
  places: string[];
};

const hhmm = (v: string | null) => (v ?? "").slice(0, 5) || "—";

// The lines that differ between two states of a hike: [label, before, after].
export function changedLines(before: TourChangeFacts | null, after: TourChangeFacts | null): [string, string, string][] {
  if (!before || !after) return [];
  const lines: [string, string, string][] = [];
  const add = (label: string, a: string, b: string) => {
    if (a !== b) lines.push([label, a, b]);
  };
  add("Օր", before.date, after.date);
  add("Վերջին օր", before.end_date ?? "—", after.end_date ?? "—");
  add("Գիշերակաց", before.overnight ? "Այո" : "Ոչ", after.overnight ? "Այո" : "Ոչ");
  add("Մեկնելու ժամ", hhmm(before.meeting_time), hhmm(after.meeting_time));
  add("Մեկնելու վայր", before.meeting_point ?? "—", after.meeting_point ?? "—");
  add("Երթուղի", before.places.join(", ") || "—", after.places.join(", ") || "—");
  return lines;
}
