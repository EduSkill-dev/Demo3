import { NextResponse } from "next/server";
import { clubNameOk, tidyClubName } from "@/lib/clubName";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorReport } from "@/lib/errors";
import { isExternalAccount } from "@/lib/profileComplete";

const PHONE_RE = /^[+0-9 ()\-]{8,20}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// A person who came in through Google and wants a CLUB account. Google
// sign-in always creates an individual first; this turns that fresh,
// still-empty account into a club. Allowed once, and only while the account
// has done nothing as an individual.
async function handlePOST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Մուտք գործեք։", 401);
  if (!isExternalAccount(user)) return fail("Այս եղանակը միայն Google-ով մուտք գործածների համար է։", 403);

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clubName = tidyClubName(str(b.clubName, 200));
  const firstName = str(b.firstName, 60);
  const lastName = str(b.lastName, 60);
  const phone = str(b.phone, 20);
  if (!clubName || !firstName || !lastName) return fail("Լրացրեք բոլոր դաշտերը։");
  if (!clubNameOk(clubName)) return fail("Ակումբի անունը՝ մինչև 50 նշան, մեկ լեզվի տառեր, թվեր, «_» և բառերի միջև մեկ բացատ։");
  if (!PHONE_RE.test(phone)) return fail("Նշեք ճիշտ հեռախոսահամար։");

  const db = createAdminClient();
  const { data: p } = await db.from("profiles").select("role, status, phone, birth_date, gender").eq("id", user.id).maybeSingle();
  const profile = p as { role: string; status: string; phone: string | null; birth_date: string | null; gender: string | null } | null;
  if (!profile || profile.status !== "active") return fail("Հաշիվը հասանելի չէ։", 403);
  if (profile.role === "club") return NextResponse.json({ ok: true });
  // An individual who already finished the profile or used the account stays one.
  const [{ count: bookings }, { count: requests }] = await Promise.all([
    db.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    db.from("tour_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  if (profile.role !== "individual" || profile.phone || profile.birth_date || profile.gender || (bookings ?? 0) > 0 || (requests ?? 0) > 0) {
    return fail("Այս հաշիվն արդեն գրանցված է որպես անհատ։ Ակումբ գրանցելու համար օգտագործեք այլ էլ. հասցե։", 409);
  }

  const [phoneCheck, nameCheck] = await Promise.all([db.rpc("phone_in_use", { p_phone: phone }), db.rpc("club_name_in_use", { p_name: clubName })]);
  if (nameCheck.data === true) return fail("Այս անունով ակումբ արդեն գրանցված է։", 409);
  if (phoneCheck.data === true) return fail("Այս հեռախոսահամարով հաշիվ արդեն կա։", 409);

  const { error: roleError } = await db.from("profiles").update({ role: "club", first_name: firstName, last_name: lastName }).eq("id", user.id);
  if (roleError) return fail(roleError.message, 500);
  const { error: clubError } = await db.from("clubs").insert({ owner_id: user.id, name: clubName, phone });
  if (clubError) {
    await db.from("profiles").update({ role: "individual" }).eq("id", user.id);
    return fail(clubError.message, 500);
  }
  return NextResponse.json({ ok: true });
}

export const POST = withErrorReport("auth", handlePOST);
