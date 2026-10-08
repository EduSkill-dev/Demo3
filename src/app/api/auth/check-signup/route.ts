import { tooMany } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Asked by the sign-up pages before they create the account (and before any
// confirmation email goes out): is this phone number, or this club name,
// already registered? The database refuses duplicates either way (migration
// 0034); this is what lets the form say so in plain words.
export async function POST(req: Request) {
  const limited = await tooMany(req, "signup-check", 40, 60);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { phone?: string; clubName?: string };
  const phone = (body.phone ?? "").trim().slice(0, 40);
  const clubName = (body.clubName ?? "").trim().slice(0, 200);

  const db = createAdminClient();
  const [phoneCheck, nameCheck] = await Promise.all([
    phone ? db.rpc("phone_in_use", { p_phone: phone }) : Promise.resolve({ data: false }),
    clubName ? db.rpc("club_name_in_use", { p_name: clubName }) : Promise.resolve({ data: false }),
  ]);
  return NextResponse.json({ phoneTaken: phoneCheck.data === true, nameTaken: nameCheck.data === true });
}
