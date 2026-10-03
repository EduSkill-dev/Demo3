import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeTestCard } from "@/lib/mockPayment";
import { ADVANCED_PRICE_AMD, type Tariff } from "@/types/database";
import {
  bookingConfirmationEmail,
  emailStatus,
  paymentReceiptEmail,
  sendEmail,
} from "@/lib/email";

type Body = {
  kind?: "subscription" | "booking";
  tariff?: Tariff;
  tour_id?: string;
  card?: { number?: string; exp?: string; cvc?: string };
};

type TourRow = {
  id: string;
  title: string;
  date: string;
  price: number | string;
  meeting_point: string | null;
  meeting_time: string | null;
  cancel_deadline_hours: number | null;
  clubs: { name: string } | null;
};

// The single place money-like things happen. Today it runs the mock gateway
// in src/lib/mockPayment.ts; swapping in a real provider means replacing that
// one call and keeping the rest of this route. Payments, tariff changes and
// bookings are written with the service role: browsers cannot write them.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const kind = body.kind === "booking" ? "booking" : "subscription";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Մուտք գործիր։" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, email")
    .eq("id", auth.user.id)
    .single();
  const to = (profile as { email: string } | null)?.email ?? "";
  const admin = createAdminClient();

  let clubId: string | null = null;
  let label = "";
  let amount = 0;
  let nextTariff: Tariff | null = null;
  let tour: TourRow | null = null;
  let existingBookingId: string | null = null;

  if (kind === "subscription") {
    if (profile?.role !== "club") {
      return NextResponse.json(
        { error: "Տարիֆը փոխում են միայն ակումբները։" },
        { status: 403 }
      );
    }
    const target = body.tariff === "advanced" ? "advanced" : "start";
    const { data: club } = await supabase
      .from("clubs")
      .select("id, name, tariff")
      .eq("owner_id", auth.user.id)
      .single();
    if (!club) {
      return NextResponse.json({ error: "Ակումբը չի գտնվել։" }, { status: 404 });
    }
    clubId = (club as { id: string }).id;
    label = `Ակումբի տարիֆ՝ ${target === "advanced" ? "Advanced" : "START"}`;
    amount = target === "advanced" ? ADVANCED_PRICE_AMD : 0;
    nextTariff = target;
  } else {
    if (profile?.role !== "individual") {
      return NextResponse.json(
        { error: "Ակումբները չեն կարող գրանցվել արշավներին։" },
        { status: 403 }
      );
    }
    if (!body.tour_id) {
      return NextResponse.json({ error: "Արշավի համարը պարտադիր է։" }, { status: 400 });
    }

    // The tour is read before the card is charged: its price is the amount,
    // and an already-confirmed signup must never reach the gateway.
    const { data: tourRow } = await supabase
      .from("tours")
      .select("id, title, date, price, meeting_point, meeting_time, cancel_deadline_hours, clubs(name)")
      .eq("id", body.tour_id)
      .maybeSingle();

    if (!tourRow) {
      return NextResponse.json({ error: "Արշավը չի գտնվել։" }, { status: 404 });
    }
    tour = tourRow as unknown as TourRow;
    amount = Number(tour.price) || 0;

    const { data: existing } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("tour_id", tour.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (existing?.status === "confirmed") {
      return NextResponse.json(
        { error: "Արդեն գրանցված ես այս արշավին։" },
        { status: 409 }
      );
    }
    existingBookingId = existing?.id ?? null;
  }

  // Nothing to charge (switching to the free START plan): skip the gateway.
  const charge =
    amount > 0
      ? chargeTestCard(body.card?.number ?? "", body.card?.exp, body.card?.cvc)
      : { status: "succeeded" as const, last4: null, message: null };

  // Record every attempt, declined ones included — that is what a real
  // gateway's dashboard shows too.
  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      user_id: auth.user.id,
      club_id: clubId,
      tour_id: kind === "booking" ? body.tour_id : null,
      kind,
      tariff: kind === "subscription" ? nextTariff : null,
      amount,
      currency: "AMD",
      status: charge.status,
      provider: "mock",
      card_last4: charge.last4,
      message: charge.message,
    })
    .select("id")
    .single();

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 400 });
  }

  if (charge.status === "declined") {
    return NextResponse.json({
      status: "declined",
      message: charge.message,
      last4: charge.last4,
      payment_id: (payment as { id: string }).id,
    });
  }

  /* ---------------------------------------------------- subscription upgrade */
  if (kind === "subscription" && nextTariff) {
    const { error: tariffError } = await admin
      .from("clubs")
      .update({ tariff: nextTariff })
      .eq("id", clubId!);

    if (tariffError) {
      return NextResponse.json({ error: tariffError.message }, { status: 400 });
    }

    const result = await sendEmail(
      paymentReceiptEmail({
        to,
        kind,
        label,
        amount,
        cardLast4: charge.last4,
        status: "succeeded",
      })
    );

    return NextResponse.json({
      status: "succeeded",
      last4: charge.last4,
      payment_id: (payment as { id: string }).id,
      tariff: nextTariff,
      email: emailStatus(result),
    });
  }

  /* ------------------------------------------------------------ paid booking */
  const t = tour!;

  let booking: { id: string };
  if (existingBookingId) {
    // Re-activating the cancelled signup — the seats are re-checked by the
    // capacity trigger just like a fresh insert would be.
    const { error: reactivateError } = await admin
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", existingBookingId);
    if (reactivateError) {
      return NextResponse.json(
        { error: reactivateError.message },
        { status: reactivateError.code === "P0001" ? 409 : 400 }
      );
    }
    booking = { id: existingBookingId };
  } else {
    const { data, error: bookingError } = await admin
      .from("bookings")
      .insert({ tour_id: t.id, user_id: auth.user.id, status: "confirmed" })
      .select("id")
      .single();

    if (bookingError) {
      return NextResponse.json(
        { error: bookingError.message, status: "declined" },
        { status: bookingError.code === "P0001" ? 409 : 400 }
      );
    }
    booking = data as { id: string };
  }

  const [receipt, confirmation] = await Promise.all([
    sendEmail(
      paymentReceiptEmail({
        to,
        kind,
        label: t.title,
        amount,
        cardLast4: charge.last4,
        status: "succeeded",
      })
    ),
    sendEmail(
      bookingConfirmationEmail({
        to,
        firstName: (profile as { first_name: string | null } | null)?.first_name ?? null,
        tourTitle: t.title,
        date: t.date,
        clubName: t.clubs?.name ?? "—",
        meetingPoint: t.meeting_point,
        meetingTime: t.meeting_time,
        cancelHours: t.cancel_deadline_hours,
      })
    ),
  ]);

  return NextResponse.json({
    status: "succeeded",
    last4: charge.last4,
    payment_id: (payment as { id: string }).id,
    booking,
    email:
      receipt.ok && confirmation.ok
        ? "sent"
        : emailStatus(receipt) === "skipped" || emailStatus(confirmation) === "skipped"
          ? "skipped"
          : "failed",
  });
}
