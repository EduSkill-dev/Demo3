import { getPublicTours } from "@/lib/publicTours";
import { getT } from "@/i18n/server";
import { buildIcs, icsResponse, siteOrigin } from "@/lib/ics";

// One hike, for the "add to my calendar" button.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });
  const t = await getT();
  const labels = {
    region: (k: string) => t(`region.${k}`),
    difficulty: (k: string) => t(`difficulty.${k}`),
    difficultyLabel: t("toursPage.difficulty"),
    overnight: t("calendar.night"),
  };
  const tours = await getPublicTours({ tourId: params.id });
  if (tours.length === 0) return new Response("Not found", { status: 404 });
  return icsResponse(buildIcs(tours, siteOrigin(req), labels), "culmen-hike.ics");
}
