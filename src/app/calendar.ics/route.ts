import { getPublicTours } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import { REGIONS } from "@/lib/catalog";
import { addDays, coversDay, isDay, todayInYerevan } from "@/lib/calendar";
import { buildIcs, icsResponse, siteOrigin } from "@/lib/ics";

// Every club's published hikes from 30 days ago onward, as a calendar feed.
//   ?club=<id>  ?region=<key>  narrow it;  ?day=YYYY-MM-DD  only that day.
// Public data only — no participant, no contact.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const day = params.get("day");
  const club = params.get("club") ?? "";
  const region = params.get("region") ?? "";
  const t = await getT();
  const labels = {
    region: (k: string) => t(`region.${k}`),
    difficulty: (k: string) => t(`difficulty.${k}`),
    difficultyLabel: t("toursPage.difficulty"),
    overnight: t("calendar.night"),
  };

  let tours = await getPublicTours(
    isDay(day) ? { range: { from: day, to: day } } : { range: { from: addDays(todayInYerevan(), -30) }, clubId: /^[0-9a-f-]{36}$/i.test(club) ? club : undefined }
  );
  if (isDay(day)) tours = tours.filter((x) => coversDay(x, day));
  if ((REGIONS as readonly string[]).includes(region)) tours = tours.filter((x) => x.regions.includes(region));
  return icsResponse(buildIcs(tours, siteOrigin(req), labels), isDay(day) ? `culmen-${day}.ics` : "culmen.ics");
}
