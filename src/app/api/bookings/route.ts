import { withErrorReport } from "@/lib/errors";
import { inactiveAccountError } from "@/lib/admin";
import { unfinishedProfileError } from "@/lib/profileGate";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseEmergency, type EmergencyParsed } from "@/lib/emergency";
import {
  bookingCancelledEmail,
  clubCancellationEmail,
  bookingConfirmationEmail,
  emailStatus,
  sendEmail,
} from "@/lib/email";

type TourRow = {
  id: string;
  title: string;
  date: string;
  meeting_point: string | null;
  meeting_time: string | null;
  price: number | string | null;
  cancel_hours: number;
  clubs: { name: string } | null;
};

// Bookings go through the server so the confirmation email is sent from a
// trusted place: the browser never sees an email key, and a failed send never
// loses the booking. Reads use the caller's session (RLS); writes use the
// service role, because browsers may no longer write bookings directly.
async function handlePOST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    tour_id?: string;
    booking_id?: string;
    emergency?: unknown; // { name, phone, remember } — optional
    source?: unknown; // the ?ref= of the link that brought them, if any
  };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Մուտք գործիր։" }, { status: 401 });
  }

  const inactive = await inactiveAccountError(auth.user.id);
  if (inactive) return NextResponse.json({ error: inactive }, { status: 403 });
  const unfinished = await unfinishedProfileError(auth.user);
  if (unfinished) return NextResponse.json({ error: unfinished, code: "profile_incomplete" }, { status: 409 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, phone, email")
    .eq("id", auth.user.id)
    .single();

  if (profile?.role !== "individual") {
    return NextResponse.json(
      { error: "Ակումբները չեն կարող գրանցվել արշավներին։" },
      { status: 403 }
    );
  }

  const to = (profile as { email: string }).email;
  const admin = createAdminClient();

  // The contact goes on the booking (the club running the hike sees it there)
  // and, when asked, into the person's own saved contact for next time.
  const storeEmergency = async (bookingId: string, parsed: Extract<EmergencyParsed, { ok: true }>) => {
    await admin
      .from("bookings")
      .update({ emergency_contact_name: parsed.contact?.name ?? null, emergency_contact_phone: parsed.contact?.phone ?? null })
      .eq("id", bookingId)
      .eq("user_id", auth.user!.id);
    if (parsed.contact && parsed.remember) {
      await admin.from("emergency_contacts").upsert({ user_id: auth.user!.id, ...parsed.contact, updated_at: new Date().toISOString() });
    }
  };

  // Only the networks we hand out links for; anything else counts as Culmen itself.
  const SOURCES = ["facebook", "instagram", "whatsapp", "viber", "telegram", "link"];
  const source = typeof body.source === "string" && SOURCES.includes(body.source) ? body.source : null;

  /* ----------------------------------------------------- source of a paid one */
  // The payment route created the booking; the page adds where the person came from.
  if (body.action === "source") {
    if (source) {
      await admin.from("bookings").update({ source }).eq("id", body.booking_id ?? "").eq("user_id", auth.user.id).is("source", null);
    }
    return NextResponse.json({ ok: true });
  }

  /* ------------------------------------------------- emergency contact only */
  // After a paid booking (created by the payment route), or to change it.
  if (body.action === "emergency") {
    const parsed = parseEmergency(body.emergency);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { data: own } = await supabase
      .from("bookings")
      .select("id")
      .eq("id", body.booking_id ?? "")
      .eq("user_id", auth.user.id)
      .eq("status", "confirmed")
      .maybeSingle();
    if (!own) return NextResponse.json({ error: "Գրանցումը չի գտնվել։" }, { status: 404 });
    await storeEmergency(own.id, parsed);
    return NextResponse.json({ ok: true });
  }

  /* ----------------------------------------------------------- cancellation */
  if (body.action === "cancel") {
    if (!body.booking_id) {
      return NextResponse.json({ error: "Գրանցման համարը պարտադիր է։" }, { status: 400 });
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, tours(title, date, cancel_hours, clubs(name))")
      .eq("id", body.booking_id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Գրանցումը չի գտնվել։" }, { status: 404 });
    }

    // The select above runs under RLS, so finding the row proves ownership.
    const { error } = await admin
      .from("bookings")
      .update({ status: "cancelled", emergency_contact_name: null, emergency_contact_phone: null })
      .eq("id", body.booking_id)
      .eq("user_id", auth.user.id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "P0001" ? 409 : 400 }
      );
    }

    const tour = booking.tours as unknown as {
      title: string;
      date: string;
      cancel_hours: number;
  clubs: { name: string } | null;
    } | null;

    let email: string = "skipped";
    if (tour) {
      const result = await sendEmail(
        bookingCancelledEmail({
          to,
          tourTitle: tour.title,
          date: tour.date,
          clubName: tour.clubs?.name ?? "—",
        })
      );
      email = emailStatus(result);

      // The club hears about it too (it also sees the application marked
      // cancelled and unread in its dashboard).
      const { data: owner } = await admin
        .from("bookings")
        .select("tours(clubs(profiles!clubs_owner_id_fkey(email)))")
        .eq("id", body.booking_id)
        .single();
      const clubEmail = (owner as unknown as { tours: { clubs: { profiles: { email: string } | null } | null } | null } | null)
        ?.tours?.clubs?.profiles?.email;
      if (clubEmail) {
        await sendEmail(
          clubCancellationEmail({
            to: clubEmail,
            tourTitle: tour.title,
            date: tour.date,
            participant: [profile?.first_name, (profile as { last_name?: string | null }).last_name].filter(Boolean).join(" ") || to,
            phone: (profile as { phone?: string | null }).phone ?? null,
            email: to,
          })
        );
      }
    }

    return NextResponse.json({ ok: true, email });
  }

  /* ---------------------------------------------------------------- booking */
  if (!body.tour_id) {
    return NextResponse.json({ error: "Արշավի համարը պարտադիր է։" }, { status: 400 });
  }

  const { data: tourRow } = await supabase
    .from("tours")
    .select("id, title, date, meeting_point, meeting_time, price, cancel_hours, clubs(name)")
    .eq("id", body.tour_id)
    .maybeSingle();

  if (!tourRow) {
    return NextResponse.json({ error: "Արշավը չի գտնվել։" }, { status: 404 });
  }
  const tour = tourRow as unknown as TourRow;

  const emergency = parseEmergency(body.emergency);
  if (!emergency.ok) return NextResponse.json({ error: emergency.error }, { status: 400 });

  // Paid tours are booked only by /api/payments/charge after the card clears.
  if (Number(tour.price) > 0) {
    return NextResponse.json(
      { error: "Այս արշավը վճարովի է․ գրանցվիր վճարման միջոցով։" },
      { status: 402 }
    );
  }

  // One row per user+tour, so a previously cancelled signup is re-activated
  // instead of inserted. Both paths run through the capacity trigger and both
  // get the confirmation email.
  const { data: existing } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("tour_id", tour.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  let booking: { id: string } | null = null;

  if (existing) {
    if (existing.status === "confirmed") {
      return NextResponse.json(
        { error: "Արդեն գրանցված ես այս արշավին։" },
        { status: 409 }
      );
    }
    const { error: updateError } = await admin
      .from("bookings")
      .update({ status: "confirmed", source, attended: null })
      .eq("id", existing.id);
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: updateError.code === "P0001" ? 409 : 400 }
      );
    }
    booking = { id: existing.id };
  } else {
    const { data, error } = await admin
      .from("bookings")
      .insert({ tour_id: tour.id, user_id: auth.user.id, status: "confirmed", source })
      .select("id")
      .single();

    if (error) {
      const status = error.code === "P0001" ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    booking = data as { id: string };
  }
  await storeEmergency(booking.id, emergency);

  const result = await sendEmail(
    bookingConfirmationEmail({
      to,
      firstName: (profile as { first_name: string | null }).first_name,
      tourTitle: tour.title,
      date: tour.date,
      clubName: tour.clubs?.name ?? "—",
      cancelHours: tour.cancel_hours,
      meetingPoint: tour.meeting_point,
      meetingTime: tour.meeting_time,
    })
  );

  return NextResponse.json({
    ok: true,
    booking,
    email: emailStatus(result),
  });
}

// A crash or a 5xx answer here is logged and the admins are told.
export const POST = withErrorReport("bookings", handlePOST);
