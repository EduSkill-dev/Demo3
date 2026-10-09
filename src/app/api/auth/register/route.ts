import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardPublic } from "@/lib/rateLimit";
import { MIN_PASSWORD } from "@/lib/authErrors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9 ()-]{8,20}$/;
const fail = (code: string, message: string, status = 400) => NextResponse.json({ error: { code, message, status } }, { status });

// Sign-up goes through the server so that it can be counted per address and
// paused when it is being flooded (see guardPublic), and so that a taken
// phone number or club name is refused before the account exists and before
// any confirmation email is sent.
export async function POST(req: Request) {
  const limited = await guardPublic(req, "register");
  if (limited) return limited;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const role = b.role === "club" ? "club" : "individual";
  const email = str(b.email, 254).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  const phone = str(b.phone, 20);
  const clubName = str(b.clubName, 100);
  const firstName = str(b.firstName, 60);
  const lastName = str(b.lastName, 60);
  const birthDate = str(b.birthDate, 10);
  const gender = str(b.gender, 20);

  if (!EMAIL_RE.test(email)) return fail("validation_failed", "Նշեք ճիշտ էլ. հասցե։");
  if (password.length < MIN_PASSWORD || password.length > 72) return fail("weak_password", "");
  if (!PHONE_RE.test(phone)) return fail("validation_failed", "Նշեք ճիշտ հեռախոսահամար։");
  if (role === "club" ? clubName.length < 2 : !firstName || !lastName) return fail("validation_failed", "Լրացրեք բոլոր դաշտերը։");
  if (role === "individual" && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return fail("validation_failed", "Նշեք ճիշտ ծննդյան ամսաթիվ։");

  const db = createAdminClient();
  const [phoneCheck, nameCheck] = await Promise.all([
    db.rpc("phone_in_use", { p_phone: phone }),
    role === "club" ? db.rpc("club_name_in_use", { p_name: clubName }) : Promise.resolve({ data: false }),
  ]);
  if (nameCheck.data === true) return fail("club_name_taken", "", 409);
  if (phoneCheck.data === true) return fail("phone_taken", "", 409);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${new URL(req.url).origin}/auth/confirm`,
      data:
        role === "club"
          ? { role, club_name: clubName, phone }
          : { role, first_name: firstName, last_name: lastName, birth_date: birthDate, gender, phone },
    },
  });
  if (error) return fail(error.code ?? "signup_failed", error.message, error.status && error.status >= 400 ? error.status : 400);
  // An already-registered email comes back as a user without identities.
  if (data.user && data.user.identities?.length === 0) return fail("email_exists", "", 409);
  return NextResponse.json({ ok: true, session: !!data.session });
}
