import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { getPublicTours } from "@/lib/publicTours";
import { addDays, isDay } from "@/lib/calendar";

// For the tour form's planner: which published hikes other clubs already
// have on the chosen day(s), and the club's own hikes on them. Published
// listings only — never a draft of another club, never a participant.
//   ?date=YYYY-MM-DD [&end=YYYY-MM-DD] [&exclude=<own tour id being edited>]
export async function GET(req: Request) {
  const mine = await getMyClub();
  if (!mine) return NextResponse.json({ error: "Մուտք գործեք որպես ակումբ։" }, { status: 401 });
  if (!mine.limits.config.planner_other_clubs) return NextResponse.json({ error: "Պլանավորիչը Ձեր փաթեթում ներառված չէ։" }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const from = params.get("date");
  if (!isDay(from)) return NextResponse.json({ error: "Նշեք ամսաթիվը։" }, { status: 400 });
  const endParam = params.get("end");
  // A hike is at most 60 days long (database rule); never look further.
  const to = isDay(endParam) && endParam > from && endParam <= addDays(from, 60) ? endParam : from;
  const exclude = params.get("exclude");

  const published = await getPublicTours({ range: { from, to } });
  const others = published
    .filter((x) => x.club_id !== mine.club.id)
    .map((x) => ({ id: x.id, title: x.title, club: x.club.name, date: x.date, endDate: x.end_date, regions: x.regions, difficulty: x.difficulty }));

  const supabase = await createClient();
  const { data } = await supabase
    .from("tours")
    .select("id, title, date, end_date, regions, difficulty, status")
    .eq("club_id", mine.club.id)
    .neq("status", "cancelled")
    .lte("date", to)
    .or(`date.gte.${from},end_date.gte.${from}`);
  const own = ((data ?? []) as { id: string; title: string; date: string; end_date: string | null; regions: string[]; difficulty: string }[])
    .filter((x) => x.id !== exclude)
    .map((x) => ({ id: x.id, title: x.title, date: x.date, endDate: x.end_date, regions: x.regions, difficulty: x.difficulty }));

  return NextResponse.json({ others, own }, { headers: { "Cache-Control": "no-store" } });
}
