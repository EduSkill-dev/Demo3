import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newTourEmail, sendEmail } from "@/lib/email";

// The database trigger already wrote one notification row per follower; this
// route turns those rows into emails — exactly once each, because it only
// picks rows where emailed_at is still null and stamps them as it goes.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { tour_id?: string };
  if (!body.tour_id) {
    return NextResponse.json({ error: "Արշավի համարը պարտադիր է։" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Մուտք գործիր։" }, { status: 401 });
  }

  // Only the owner of this tour's club may announce it.
  const { data: tour } = await supabase
    .from("tours")
    .select("id, title, date, regions, club_id, clubs(id, owner_id, name)")
    .eq("id", body.tour_id)
    .maybeSingle();

  // With .maybeSingle(), PostgREST returns the nested relation as a single
  // object (not an array). Normalise so the code works in both cases.
  const rawClub = tour?.clubs as
    | { id: string; owner_id: string; name: string }
    | { id: string; owner_id: string; name: string }[]
    | undefined;
  const club = Array.isArray(rawClub) ? rawClub[0] : rawClub;
  if (!tour || !club || club.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Այս արշավը հրապարակելու իրավունք չունես։" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("notifications")
    .select("id, user_id, profiles(email)")
    .eq("tour_id", body.tour_id)
    .eq("kind", "new_tour")
    .is("emailed_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of (rows ?? []) as unknown as {
    id: string;
    profiles: { email: string } | { email: string }[] | null;
  }[]) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!profile?.email) {
      skipped++;
      await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", row.id);
      continue;
    }

    const result = await sendEmail(
      newTourEmail({
        to: profile.email,
        clubName: club.name,
        tourTitle: (tour as { title: string }).title,
        date: (tour as { date: string }).date,
        regions: ((tour as { regions: string[] }).regions ?? []) as string[],
      })
    );

    if (result.ok || result.skipped) {
      if (result.ok) sent++;
      else skipped++;
      await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", row.id);
    } else {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, total: rows?.length ?? 0, sent, skipped, failed });
}
