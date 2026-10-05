// Server-only: removing an account with everything it owns. Used by the
// "delete my account" route and by admins.
import { createAdminClient } from "@/lib/supabase/admin";
import { clubCancellationEmail, sendEmail } from "@/lib/email";

const BUCKET = "club-assets";
const FOLDERS = ["clubs", "guides", "tours", "avatars"];

type Result = { ok: true; cancelled: number } | { ok: false; error: string };

// Files are stored under <folder>/<user id>/…
async function removeFiles(userId: string) {
  const storage = createAdminClient().storage.from(BUCKET);
  for (const folder of FOLDERS) {
    const { data } = await storage.list(`${folder}/${userId}`, { limit: 1000 });
    const paths = (data ?? []).map((f) => `${folder}/${userId}/${f.name}`);
    if (paths.length) await storage.remove(paths);
  }
}

// An individual: cancel their upcoming bookings (even inside 48 h) and tell
// each club, then remove the user. Bookings, reviews and payments stay with
// user_id = null, shown as "deleted user".
export async function deleteIndividual(userId: string): Promise<Result> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name, phone, email")
    .eq("id", userId)
    .single();
  const p = profile as { first_name: string | null; last_name: string | null; phone: string | null; email: string } | null;
  if (!p) return { ok: false, error: "Հաշիվը չի գտնվել։" };

  const { data: cancelled, error: cancelError } = await admin.rpc("cancel_bookings_for_deleted_account", { p_user: userId });
  if (cancelError) return { ok: false, error: cancelError.message };

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

  await removeFiles(userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, cancelled: tourIds.length };
}

// A club (admins only): its tours, guides, reviews and applications go with
// it. People signed up for its upcoming hikes get a platform notice first.
export async function deleteClub(userId: string): Promise<Result> {
  const admin = createAdminClient();
  const { data: club } = await admin.from("clubs").select("id, name").eq("owner_id", userId).maybeSingle();
  const c = club as { id: string; name: string } | null;

  let cancelled = 0;
  if (c) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: tours } = await admin
      .from("tours")
      .select("id, title, date")
      .eq("club_id", c.id)
      .neq("status", "cancelled")
      .gte("date", today);
    const upcoming = (tours ?? []) as { id: string; title: string; date: string }[];
    if (upcoming.length) {
      const { data: bookings } = await admin
        .from("bookings")
        .select("user_id, tour_id")
        .in("tour_id", upcoming.map((t) => t.id))
        .eq("status", "confirmed")
        .not("user_id", "is", null);
      const notices = ((bookings ?? []) as { user_id: string; tour_id: string }[]).map((b) => {
        const tour = upcoming.find((t) => t.id === b.tour_id)!;
        return {
          user_id: b.user_id,
          club_id: null,
          tour_id: null,
          kind: "platform",
          sender_type: "platform",
          message: `«${c.name}» ակումբի «${tour.title}» արշավը (${tour.date}) չեղարկվել է․ ակումբն այլևս հարթակում չէ։`,
        };
      });
      cancelled = notices.length;
      if (notices.length) await admin.from("notifications").insert(notices);
    }
  }

  await removeFiles(userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, cancelled };
}
