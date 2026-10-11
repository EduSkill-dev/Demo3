// iCalendar (RFC 5545) text for hikes, written by hand — no dependency.
// Only what the public pages show goes in: never a participant, never a
// phone number.
import { addDays, lastDayOf } from "@/lib/calendar";
import type { PublicTour } from "@/lib/publicTours";

const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 bytes continue on the next line after a space; a
// UTF-8 character is never cut in half.
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, "utf8");
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const compact = (iso: string) => iso.replace(/-/g, "");

export type IcsLabels = {
  region: (key: string) => string;
  difficulty: (key: string) => string;
  difficultyLabel: string; // "Բարդություն"
  overnight: string; // "Գիշերակացով"
};

export function buildIcs(tours: PublicTour[], origin: string, labels: IcsLabels, name = "Culmen · Արշավներ"): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Culmen//Calendar//HY",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-WR-TIMEZONE:Asia/Yerevan",
  ];
  for (const tour of tours) {
    const url = `${origin}/tours/${tour.id}`;
    const regions = tour.regions.map(labels.region).join(", ");
    const details = [
      regions,
      `${labels.difficultyLabel}՝ ${labels.difficulty(tour.difficulty)}${tour.overnight ? ` · ${labels.overnight}` : ""}`,
      url,
    ].filter(Boolean);
    lines.push(
      "BEGIN:VEVENT",
      `UID:tour-${tour.id}@culmen.am`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(tour.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(lastDayOf(tour), 1))}`, // exclusive
      `SUMMARY:${escapeText(`${tour.title} · ${tour.club.name}`)}`,
      `DESCRIPTION:${escapeText(details.join("\n"))}`,
      ...(regions ? [`LOCATION:${escapeText(regions)}`] : []),
      `URL:${url}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function icsResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

export const siteOrigin = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
