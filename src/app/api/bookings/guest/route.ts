import { withErrorReport } from "@/lib/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardPublic } from "@/lib/rateLimit";
import { MIN_PASSWORD } from "@/lib/authErrors";
import { chargeTestCard } from "@/lib/mockPayment";
import { bookingCancelledEmail, bookingConfirmationEmail, clubCancellationEmail, emailStatus, paymentReceiptEmail, sendEmail } from "@/lib/email";

// Booking without signing in (from a shared link, say):
//   { action: "book", tour_id, firstName, lastName, email, phone, birthDate, gender,
//     createAccount?, password?, source?, card? }  — a paid hike also charges the card
//   { action: "cancel", token }                  — from the link in the confirmation email
// The details are kept as a guest (for the club and for us). With
// createAccount the person is also signed up; once they confirm their email
// the guest booking moves to the account (database trigger, 0070).
// Someone who already has an account is asked to sign in instead.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9 ()-]{8,20}$/;
const SOURCES = ["facebook", "instagram", "whatsapp", "viber", "telegram", "link"];
const fail = (error: string, status = 400, code?: string) => NextResponse.json({ error, ...(code ? { code } : {}) }, { status });

type TourRow = {
  id: string;
  title: string;
  date: string;
  price: number | string | null;
  meeting_point: string | null;
  meeting_time: string | null;
  cancel_hours: number;
  clubs: { name: string; profiles: { email: string } | null } | null;
};

async function handlePOST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const db = createAdminClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  /* -------------------------------------------------------------- cancel */
  if (b.action === "cancel") {
    const token = str(b.token, 40);
    if (!/^[0-9a-f-]{36}$/i.test(token)) return fail("Հղումը սխալ է։", 400);
    const { data } = await db
      .from("bookings")
      .select("id, status, guest_id, guests(first_name, last_name, email, phone), tours(title, date, clubs(name, profiles!clubs_owner_id_fkey(email)))")
      .eq("cancel_token", token)
      .maybeSingle();
    const bk = data as unknown as {
      id: string;
      status: string;
      guest_id: string | null;
      guests: { first_name: string; last_name: string; email: string; phone: string } | null;
      tours: { title: string; date: string; clubs: { name: string; profiles: { email: string } | null } | null } | null;
    } | null;
    if (!bk || !bk.guest_id || !bk.guests) return fail("Ամրագրումը չի գտնվել։", 404);
    if (bk.status === "cancelled") return NextResponse.json({ ok: true, already: true });
    const { error } = await db.from("bookings").update({ status: "cancelled", emergency_contact_name: null, emergency_contact_phone: null }).eq("id", bk.id);
    if (error) return fail(error.message, error.code === "P0001" ? 409 : 400);
    const g = bk.guests;
    if (bk.tours) {
      await sendEmail(bookingCancelledEmail({ to: g.email, tourTitle: bk.tours.title, date: bk.tours.date, clubName: bk.tours.clubs?.name ?? "—" }));
      const clubEmail = bk.tours.clubs?.profiles?.email;
      if (clubEmail) {
        await sendEmail(clubCancellationEmail({ to: clubEmail, tourTitle: bk.tours.title, date: bk.tours.date, participant: `${g.first_name} ${g.last_name}`, phone: g.phone, email: g.email }));
      }
    }
    return NextResponse.json({ ok: true });
  }

  /* ---------------------------------------------------------------- book */
  const limited = await guardPublic(req, "booking");
  if (limited) return limited;

  const tourId = str(b.tour_id, 40);
  const firstName = str(b.firstName, 60);
  const lastName = str(b.lastName, 60);
  const email = str(b.email, 254).toLowerCase();
  const phone = str(b.phone, 20);
  const birthDate = str(b.birthDate, 10);
  const gender = str(b.gender, 10);
  const createAccount = b.createAccount === true;
  const password = typeof b.password === "string" ? b.password : "";
  const source = typeof b.source === "string" && SOURCES.includes(b.source) ? b.source : null;

  if (!firstName || !lastName) return fail("Լրացրեք անունն ու ազգանունը։");
  if (!EMAIL_RE.test(email)) return fail("Նշեք ճիշտ էլ. հասցե։");
  if (!PHONE_RE.test(phone)) return fail("Նշեք ճիշտ հեռախոսահամար։");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate < "1900-01-01" || birthDate > new Date().toISOString().slice(0, 10)) return fail("Նշեք ճիշտ ծննդյան ամսաթիվ։");
  if (gender !== "male" && gender !== "female") return fail("Նշեք սեռը։");
  if (createAccount && (password.length < MIN_PASSWORD || password.length > 72)) return fail(`Գաղտնաբառը պետք է լինի առնվազն ${MIN_PASSWORD} նիշ։`);

  // Someone with an account signs in: their bookings and history live there.
  const [{ data: byEmail }, phoneCheck] = await Promise.all([
    db.from("profiles").select("id").ilike("email", email).maybeSingle(),
    db.rpc("phone_in_use", { p_phone: phone }),
  ]);
  if (byEmail || phoneCheck.data === true) {
    return fail("Այս էլ. հասցեով կամ հեռախոսով արդեն կա հաշիվ․ մուտք գործեք՝ ամրագրելու համար։", 409, "account_exists");
  }

  const { data: tourRow } = await db
    .from("tours")
    .select("id, title, date, price, meeting_point, meeting_time, cancel_hours, clubs(name, profiles!clubs_owner_id_fkey(email))")
    .eq("id", tourId)
    .maybeSingle();
  if (!tourRow) return fail("Արշավը չի գտնվել։", 404);
  const tour = tourRow as unknown as TourRow;
  const amount = Number(tour.price) || 0;

  // The guest: one per email, its details refreshed with every booking.
  const { data: guestRow, error: guestError } = await db
    .from("guests")
    .upsert({ email, first_name: firstName, last_name: lastName, phone, birth_date: birthDate, gender, updated_at: new Date().toISOString() }, { onConflict: "email" })
    .select("id")
    .single();
  const guestId = (guestRow as { id: string } | null)?.id;
  if (guestError || !guestId) return fail(guestError?.message ?? "Չստացվեց պահել տվյալները։", 400);

  const { data: existing } = await db.from("bookings").select("id, status").eq("tour_id", tour.id).eq("guest_id", guestId).maybeSingle();
  if ((existing as { status: string } | null)?.status === "confirmed") return fail("Այս էլ. հասցեով արդեն ամրագրված է այս արշավը։", 409);

  // A paid hike: the card first (mock gateway, like /api/payments/charge).
  let last4: string | null = null;
  if (amount > 0) {
    const card = (b.card ?? {}) as { number?: string; exp?: string; cvc?: string };
    const charge = chargeTestCard(card.number ?? "", card.exp, card.cvc);
    last4 = charge.last4;
    await db.from("payments").insert({
      guest_id: guestId, tour_id: tour.id, kind: "booking", amount, currency: "AMD", status: charge.status, provider: "mock", card_last4: charge.last4, message: charge.message,
    });
    if (charge.status === "declined") return NextResponse.json({ status: "declined", message: charge.message }, { status: 402 });
  }

  let bookingId: string;
  let cancelToken: string;
  if (existing) {
    const { data, error } = await db.from("bookings").update({ status: "confirmed", source, attended: null }).eq("id", (existing as { id: string }).id).select("id, cancel_token").single();
    if (error) return fail(error.message, error.code === "P0001" ? 409 : 400);
    ({ id: bookingId, cancel_token: cancelToken } = data as { id: string; cancel_token: string });
  } else {
    const { data, error } = await db.from("bookings").insert({ tour_id: tour.id, guest_id: guestId, status: "confirmed", source }).select("id, cancel_token").single();
    if (error) return fail(error.message, error.code === "P0001" ? 409 : 400);
    ({ id: bookingId, cancel_token: cancelToken } = data as { id: string; cancel_token: string });
  }

  // Signing up too: an ordinary individual account (confirmation email from Supabase).
  let account: "created" | "exists" | null = null;
  if (createAccount) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/confirm`,
        data: { role: "individual", first_name: firstName, last_name: lastName, birth_date: birthDate, gender, phone },
      },
    });
    account = !error && data.user && data.user.identities?.length !== 0 ? "created" : "exists";
  }

  const cancelUrl = `${origin}/bookings/cancel/${cancelToken}`;
  const confirmation = await sendEmail(
    bookingConfirmationEmail({
      to: email,
      firstName,
      tourTitle: tour.title,
      date: tour.date,
      clubName: tour.clubs?.name ?? "—",
      cancelHours: tour.cancel_hours,
      meetingPoint: tour.meeting_point,
      meetingTime: tour.meeting_time,
      cancelUrl,
    })
  );
  if (amount > 0) await sendEmail(paymentReceiptEmail({ to: email, kind: "booking", label: tour.title, amount, cardLast4: last4, status: "succeeded" }));

  return NextResponse.json({ ok: true, booking: { id: bookingId }, account, email: emailStatus(confirmation) });
}

export const POST = withErrorReport("bookings", handlePOST);
