import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clubCancellationEmail, sendEmail } from "@/lib/email";

// Deleting an individual's account: cancel their upcoming bookings (even
// inside 48 h) and tell each club, then remove the user. Bookings, reviews
// and payments stay with user_id = null, shown as "deleted user".
export async function POST() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, phone, email")
    .eq("id", auth.user.id)
    .single();
  const p = profile as { role: string; first_name: string | null; last_name: string | null; phone: string | null; email: string } | null;
  if (p?.role !== "individual") {
    // A club's account owns tours and other people's bookings; that needs a
    // human decision, not a button.
    return NextResponse.json({ error: "Club accounts are deleted on request." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: cancelled, error: cancelError } = await admin.rpc("cancel_bookings_for_deleted_account", {
    p_user: auth.user.id,
  });
  if (cancelError) {
    return NextResponse.json({ error: cancelError.message }, { status: 500 });
  }

  const tourIds = ((cancelled ?? []) as { tour_id: string }[]).map((r) => r.tour_id);
  if (tourIds.length) {
    const { data: tours } = await admin
      .from("tours")
      .select("title, date, clubs(profiles!clubs_owner_id_fkey(email))")
      .in("id", tourIds);
    for (const tour of (tours ?? []) as unknown as {
      title: string;
      date: string;
      clubs: { profiles: { email: string } | null } | null;
    }[]) {
      const to = tour.clubs?.profiles?.email;
      if (!to) continue;
      await sendEmail(
        clubCancellationEmail({
          to,
          tourTitle: tour.title,
          date: tour.date,
          participant: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email,
          phone: p.phone,
          email: p.email,
        })
      );
    }
  }

  const { error } = await admin.auth.admin.deleteUser(auth.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cancelled: tourIds.length });
}
