import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { contactConfirmEmail, contactInboxEmail, emailStatus, ownerInbox, sendEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The footer's suggestion form. An email address is required and has to be
// proven before the message is forwarded to the owner's inbox (CONTACT_INBOX,
// else the Gmail sender), so nobody can write in someone else's name:
//   * signed in  — the account's verified address is used, forwarded at once;
//   * a visitor  — stored unconfirmed, and a link is emailed to the address;
//     /contact/confirm forwards the message when that link is opened.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    email?: string;
    phone?: string;
    website?: string;
  };
  if (body.website) return NextResponse.json({ ok: true }); // honeypot

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const verified = user?.email && user.email_confirmed_at ? user.email : null;

  const message = (body.message ?? "").trim().slice(0, 4000);
  const email = (verified ?? body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim().slice(0, 40) || null;
  if (!message) return NextResponse.json({ error: "empty_message" }, { status: 400 });
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("contact_messages")
    .insert({ message, email, phone, confirmed_at: verified ? new Date().toISOString() : null })
    .select("token")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (!verified) {
    const confirmUrl = `${new URL(req.url).origin}/contact/confirm?token=${(data as { token: string }).token}`;
    const result = await sendEmail(contactConfirmEmail({ to: email, message, confirmUrl }));
    return NextResponse.json({ ok: true, confirmed: false, email: emailStatus(result) });
  }

  const inbox = ownerInbox();
  const result = inbox
    ? await sendEmail(contactInboxEmail({ to: inbox, message, email, phone }))
    : ({ ok: false, skipped: true, reason: "no owner inbox" } as const);
  return NextResponse.json({ ok: true, confirmed: true, email: emailStatus(result) });
}
