import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailStatus, newsletterConfirmEmail, sendEmail } from "@/lib/email";
import { getLocale } from "@/i18n/server";
import { getViewer } from "@/lib/viewer";
import { guardPublic } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_AFTER_MS = 10 * 60 * 1000;
const FROZEN = "Ձեր հաշիվը սառեցված է․ գործողությունները ժամանակավորապես անհասանելի են։";

// Platform news.
//   * A registered account already receives them (profiles.platform_news);
//     signed in, this just switches them back on.
//   * A visitor's address is stored unconfirmed and gets a confirmation link
//     once — asking again says "already subscribed" or "check your inbox"
//     instead of mailing the link over and over.
// The answer's `state` tells the form what to say:
//   subscribed | already | sent | pending | account
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; website?: string };
  if (body.website) return NextResponse.json({ ok: true, state: "sent" }); // honeypot: bots fill every field

  const admin = createAdminClient();
  const viewer = await getViewer();
  if (viewer && viewer.emailConfirmed && viewer.role !== "admin") {
    if (viewer.frozen) return NextResponse.json({ error: { message: FROZEN } }, { status: 403 });
    if (viewer.platformNews) return NextResponse.json({ ok: true, state: "already" });
    const { error } = await admin.from("profiles").update({ platform_news: true }).eq("id", viewer.id);
    if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    return NextResponse.json({ ok: true, state: "subscribed" });
  }

  const limited = await guardPublic(req, "newsletter");
  if (limited) return limited;

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: { message: "invalid_email" } }, { status: 400 });
  }

  // An address that belongs to an account is managed from that account.
  const { data: account } = await admin.from("profiles").select("platform_news, role").eq("email", email).maybeSingle();
  const acc = account as { platform_news: boolean; role: string } | null;
  if (acc && acc.role !== "admin") return NextResponse.json({ ok: true, state: acc.platform_news ? "already" : "account" });

  type Row = { id: string; token: string; confirmed_at: string | null; unsubscribed_at: string | null; sent_at: string | null };
  const columns = "id, token, confirmed_at, unsubscribed_at, sent_at";
  const { data: existing } = await admin.from("newsletter_subscribers").select(columns).eq("email", email).maybeSingle();
  let row = existing as Row | null;
  if (row?.confirmed_at && !row.unsubscribed_at) return NextResponse.json({ ok: true, state: "already" });
  // The link went out a moment ago: no second email.
  if (row && !row.unsubscribed_at && row.sent_at && Date.now() - new Date(row.sent_at).getTime() < RESEND_AFTER_MS) {
    return NextResponse.json({ ok: true, state: "pending" });
  }

  const locale = await getLocale();
  const sentAt = new Date().toISOString();
  if (row) {
    const { data } = await admin
      .from("newsletter_subscribers")
      .update({ token: crypto.randomUUID(), confirmed_at: null, unsubscribed_at: null, locale, sent_at: sentAt })
      .eq("id", row.id)
      .select(columns)
      .single();
    row = data as Row;
  } else {
    const { data, error } = await admin.from("newsletter_subscribers").insert({ email, locale, sent_at: sentAt }).select(columns).single();
    if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    row = data as Row;
  }

  const origin = new URL(req.url).origin;
  const result = await sendEmail(
    newsletterConfirmEmail({
      to: email,
      confirmUrl: `${origin}/newsletter/confirm?token=${row.token}`,
      unsubscribeUrl: `${origin}/newsletter/unsubscribe?token=${row.token}`,
    })
  );
  return NextResponse.json({ ok: true, state: "sent", email: emailStatus(result) });
}
