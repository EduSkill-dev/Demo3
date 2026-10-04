import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailStatus, newSubscriberEmail, newsletterConfirmEmail, ownerInbox, sendEmail } from "@/lib/email";
import { getLocale } from "@/i18n/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Double opt-in: store the address unconfirmed and email a confirmation
// link. The answer is the same whether or not the address was already on
// the list, so the form cannot be used to probe who subscribed.
//
// A signed-in person subscribing their own account address has already
// proved they own it, so that one is confirmed straight away, with no email.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; website?: string };
  if (body.website) return NextResponse.json({ ok: true }); // honeypot: bots fill every field

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("newsletter_subscribers")
    .select("id, token, confirmed_at, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();

  type Row = { id: string; token: string; confirmed_at: string | null; unsubscribed_at: string | null };
  let row = existing as Row | null;
  if (row && row.confirmed_at && !row.unsubscribed_at) return NextResponse.json({ ok: true });

  const locale = await getLocale();

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (user?.email_confirmed_at && user.email?.toLowerCase() === email) {
    const confirmed = { confirmed_at: new Date().toISOString(), unsubscribed_at: null, locale };
    const { error } = row
      ? await admin.from("newsletter_subscribers").update(confirmed).eq("id", row.id)
      : await admin.from("newsletter_subscribers").insert({ email, ...confirmed });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await sendEmail(newSubscriberEmail({ to: ownerInbox(), email }));
    return NextResponse.json({ ok: true, confirmed: true });
  }

  if (row) {
    const { data } = await admin
      .from("newsletter_subscribers")
      .update({ token: crypto.randomUUID(), confirmed_at: null, unsubscribed_at: null, locale })
      .eq("id", row.id)
      .select("id, token, confirmed_at, unsubscribed_at")
      .single();
    row = data as Row;
  } else {
    const { data, error } = await admin
      .from("newsletter_subscribers")
      .insert({ email, locale })
      .select("id, token, confirmed_at, unsubscribed_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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
  return NextResponse.json({ ok: true, email: emailStatus(result) });
}
