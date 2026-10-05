import { inactiveAccountError } from "@/lib/admin";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  clubs: { name: string; cancel_hours: number } | null;
};

// Bookings go through the server so the confirmation email is sent from a
// trusted place: the browser never sees an email key, and a failed send never
// loses the booking. Reads use the caller's session (RLS); writes use the
// service role, because browsers may no longer write bookings directly.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    tour_id?: string;
    booking_id?: string;
  };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Մուտք գործիր։" }, { status: 401 });
  }

  const inactive = await inactiveAccountError(auth.user.id);
  if (inactive) return NextResponse.json({ error: inactive }, { status: 403 });

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

  /* ----------------------------------------------------------- cancellation */
  if (body.action === "cancel") {
    if (!body.booking_id) {
      return NextResponse.json({ error: "Գրանցման համարը պարտադիր է։" }, { status: 400 });
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, tours(title, date, clubs(name, cancel_hours))")
      .eq("id", body.booking_id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Գրանցումը չի գտնվել։" }, { status: 404 });
    }

    // The select above runs under RLS, so finding the row proves ownership.
    const { error } = await admin
      .from("bookings")
      .update({ status: "cancelled" })
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
      clubs: { name: string; cancel_hours: number } | null;
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
    .select("id, title, date, meeting_point, meeting_time, price, clubs(name, cancel_hours)")
    .eq("id", body.tour_id)
    .maybeSingle();

  if (!tourRow) {
    return NextResponse.json({ error: "Արշավը չի գտնվել։" }, { status: 404 });
  }
  const tour = tourRow as unknown as TourRow;

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
      .update({ status: "confirmed" })
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
      .insert({ tour_id: tour.id, user_id: auth.user.id, status: "confirmed" })
      .select("id")
      .single();

    if (error) {
      const status = error.code === "P0001" ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    booking = data as { id: string };
  }

  const result = await sendEmail(
    bookingConfirmationEmail({
      to,
      firstName: (profile as { first_name: string | null }).first_name,
      tourTitle: tour.title,
      date: tour.date,
      clubName: tour.clubs?.name ?? "—",
      cancelHours: tour.clubs?.cancel_hours,
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
