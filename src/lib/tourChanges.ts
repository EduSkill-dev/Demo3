// Server-only: turns the rows of tour_changes into emails, once each. Called
// right after a club's change, and by the daily job for anything left behind.
import { createAdminClient } from "@/lib/supabase/admin";
import { ownerInbox, sendEmail, sendEmailBatch, tourChangeAdminEmail, tourChangedEmail } from "@/lib/email";
import { CHANGE_REASONS, changedLines, type ChangeReason, type TourChangeFacts } from "@/lib/tourChangeReasons";
import { makeT } from "@/i18n/translate";

const hyT = makeT("hy");

type Change = {
  id: number;
  tour_id: string | null;
  club_id: string | null;
  tour_title: string;
  kind: "change" | "cancel";
  reason: ChangeReason | null;
  note: string | null;
  before: TourChangeFacts | null;
  after: TourChangeFacts | null;
};

type Person = { email: string; first_name: string | null } | null;
type Booked = { cancel_token: string; guest_id: string | null; profiles: Person; guests: Person };

export async function sendTourChangeNotices(origin: string, tourId?: string) {
  const db = createAdminClient();
  let query = db.from("tour_changes").select("id, tour_id, club_id, tour_title, kind, reason, note, before, after").is("notified_at", null).order("changed_at").limit(20);
  if (tourId) query = query.eq("tour_id", tourId);
  const { data } = await query;
  let sent = 0;

  for (const change of (data ?? []) as Change[]) {
    // Whoever stamps the row sends its emails.
    const { data: claimed } = await db.from("tour_changes").update({ notified_at: new Date().toISOString() }).eq("id", change.id).is("notified_at", null).select("id");
    if (!claimed?.length) continue;

    const [{ data: people }, { data: club }] = await Promise.all([
      change.tour_id
        ? db.from("bookings").select("cancel_token, guest_id, profiles(email, first_name), guests(email, first_name)").eq("tour_id", change.tour_id).eq("status", "confirmed")
        : Promise.resolve({ data: [] }),
      change.club_id
        ? db.from("clubs").select("name, profiles!clubs_owner_id_fkey(email)").eq("id", change.club_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const clubRow = club as unknown as { name: string; profiles: { email: string } | null } | null;
    const clubName = clubRow?.name ?? "—";
    const reason = change.reason ? [hyT(CHANGE_REASONS[change.reason]), change.note].filter(Boolean).join("․ ") : null;
    const lines = changedLines(change.before, change.after);

    const result = await sendEmailBatch(
      ((people ?? []) as unknown as Booked[])
        .map((b) => ({ person: b.profiles ?? b.guests, guest: !!b.guest_id, token: b.cancel_token }))
        .filter((b) => b.person?.email)
        .map((b) =>
          tourChangedEmail({
            to: b.person!.email,
            kind: change.kind,
            title: change.tour_title,
            clubName,
            reason,
            lines,
            tourUrl: change.tour_id ? `${origin}/tours/${change.tour_id}` : `${origin}/tours`,
            cancelUrl: b.guest ? `${origin}/bookings/cancel/${b.token}` : `${origin}/account`,
          }),
        ),
    );
    sent += result.sent;
    // Nothing got through: leave the row for the daily job.
    if (result.failed > 0 && result.sent === 0) await db.from("tour_changes").update({ notified_at: null }).eq("id", change.id);

    // Test clubs (@example.com) stay out of the admins' inbox, as on the bell.
    if (clubRow?.profiles?.email && !clubRow.profiles.email.endsWith("@example.com")) {
      await sendEmail(tourChangeAdminEmail({ to: ownerInbox(), kind: change.kind, title: change.tour_title, clubName, reason, lines, url: `${origin}/admin/tour-changes` }));
    }
  }
  return sent;
}
