import { getPublicTours } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import { addDays, todayInYerevan } from "@/lib/calendar";
import { buildIcs, icsResponse, siteOrigin } from "@/lib/ics";

// One club's published hikes as a calendar feed.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });
  const t = await getT();
  const labels = {
    region: (k: string) => t(`region.${k}`),
    difficulty: (k: string) => t(`difficulty.${k}`),
    difficultyLabel: t("toursPage.difficulty"),
    overnight: t("calendar.night"),
  };
  const tours = await getPublicTours({ clubId: params.id, range: { from: addDays(todayInYerevan(), -30) } });
  const name = tours[0] ? `Culmen · ${tours[0].club.name}` : undefined;
  return icsResponse(buildIcs(tours, siteOrigin(req), labels, name), "culmen-club.ics");
}
