import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { contactInboxEmail, emailStatus, ownerInbox, sendEmail } from "@/lib/email";

// The footer's suggestion form. Stored for the (future) admin dashboard and
// forwarded to the owner's inbox (CONTACT_INBOX, else the Gmail sender).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    email?: string;
    phone?: string;
    website?: string;
  };
  if (body.website) return NextResponse.json({ ok: true }); // honeypot

  const message = (body.message ?? "").trim().slice(0, 4000);
  // Signed in: reply to the account's own address, whatever the form sent.
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const email = (user?.email ?? body.email ?? "").trim().slice(0, 254) || null;
  const phone = (body.phone ?? "").trim().slice(0, 40) || null;
  if (!message) return NextResponse.json({ error: "empty_message" }, { status: 400 });
  if (!email && !phone) return NextResponse.json({ error: "no_reply_to" }, { status: 400 });

  const { error } = await createAdminClient().from("contact_messages").insert({ message, email, phone });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const inbox = ownerInbox();
  const result = inbox
    ? await sendEmail(contactInboxEmail({ to: inbox, message, email, phone }))
    : ({ ok: false, skipped: true, reason: "no owner inbox" } as const);
  return NextResponse.json({ ok: true, email: emailStatus(result) });
}
