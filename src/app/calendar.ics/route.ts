import { withErrorReport } from "@/lib/errors";
import { getPublicTours } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import { REGIONS } from "@/lib/catalog";
import { addDays, coversDay, isDay, todayInYerevan } from "@/lib/calendar";
import { buildIcs, icsResponse, siteOrigin } from "@/lib/ics";

// Every club's published hikes from 30 days ago onward, as a calendar feed.
//   ?club=<id>  ?region=<key>  narrow it;  ?day=YYYY-MM-DD  only that day.
// Public data only — no participant, no contact.
async function handleGET(req: Request) {
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

  // ?from=&to= (both days) narrows it to that stretch.
  const from = params.get("from");
  const to = params.get("to");
  const clubId = /^[0-9a-f-]{36}$/i.test(club) ? club : undefined;
  let tours = await getPublicTours(
    isDay(day)
      ? { range: { from: day, to: day } }
      : isDay(from)
        ? { range: { from, to: isDay(to) && to >= from ? to : undefined }, clubId }
        : { range: { from: addDays(todayInYerevan(), -30) }, clubId }
  );
  if (isDay(day)) tours = tours.filter((x) => coversDay(x, day));
  if ((REGIONS as readonly string[]).includes(region)) tours = tours.filter((x) => x.regions.includes(region));
  return icsResponse(buildIcs(tours, siteOrigin(req), labels), isDay(day) ? `culmen-${day}.ics` : isDay(from) ? `culmen-${from.slice(0, 7)}.ics` : "culmen.ics");
}

// A crash or a 5xx answer here is logged and the admins are told.
export const GET = withErrorReport("calendar", handleGET);
