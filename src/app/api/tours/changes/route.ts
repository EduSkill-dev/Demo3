import { withErrorReport } from "@/lib/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTourChangeNotices } from "@/lib/tourChanges";

// After a club changes or cancels a booked hike: the database has recorded it,
// this emails the people concerned. Only the club's owner can ask, and a change
// is emailed once however often this is called.
async function handlePOST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { tour_id?: string };
  if (!body.tour_id) return NextResponse.json({ error: "Արշավի համարը պարտադիր է։" }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Մուտք գործիր։" }, { status: 401 });

  // Read past RLS, so the check holds whatever the hike's status.
  const { data: tour } = await createAdminClient().from("tours").select("id, clubs(owner_id)").eq("id", body.tour_id).maybeSingle();
  const owner = (tour as unknown as { clubs: { owner_id: string } | null } | null)?.clubs?.owner_id;
  if (owner !== auth.user.id) return NextResponse.json({ error: "Այս արշավի իրավունքը չունես։" }, { status: 403 });

  const sent = await sendTourChangeNotices(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin, body.tour_id);
  return NextResponse.json({ ok: true, sent });
}

export const POST = withErrorReport("tours", handlePOST);
