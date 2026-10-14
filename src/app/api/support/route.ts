import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorReport } from "@/lib/errors";
import { ownerInbox, sendEmail } from "@/lib/email";
import { sendToAdmins, telegramReady, tgEscape } from "@/lib/telegram";

const SUPPORT_MAX = 1000; // about a paragraph

// The help chat: a registered account (individual or club — frozen ones
// too, they are the ones with questions) writes to the admins. There is no
// limit on how many messages, only on the length of one. The message is
// stored and forwarded to the admins' Telegram group; without Telegram it
// goes to the owner's mailbox instead, so it is never lost.
async function handlePOST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Չաթում գրելու համար մուտք գործեք։" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Գրեք հաղորդագրությունը։" }, { status: 400 });
  if (text.length > SUPPORT_MAX) return NextResponse.json({ error: `Մեկ հաղորդագրությունը կարող է լինել առավելագույնը ${SUPPORT_MAX} նիշ։` }, { status: 400 });

  const db = createAdminClient();
  const { data: p } = await db.from("profiles").select("role, status, first_name, last_name, email, chat_blocked").eq("id", user.id).maybeSingle();
  const profile = p as { role: string; status: string; first_name: string | null; last_name: string | null; email: string; chat_blocked: boolean } | null;
  if (!profile || profile.role === "admin") return NextResponse.json({ error: "Չաթը նախատեսված է անհատների և ակումբների համար։" }, { status: 403 });
  if (profile.status === "blocked") return NextResponse.json({ error: "Ձեր հաշիվն արգելափակված է։" }, { status: 403 });
  if (profile.chat_blocked) return NextResponse.json({ error: "Չաթը Ձեր հաշվի համար անջատված է ադմինիստրատորի կողմից։" }, { status: 403 });

  const { data: club } = profile.role === "club" ? await db.from("clubs").select("name").eq("owner_id", user.id).maybeSingle() : { data: null };
  const person = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const who = profile.role === "club" ? `Ակումբ «${(club as { name?: string } | null)?.name ?? "—"}»${person ? ` (${person})` : ""}` : `Անհատ ${person || "—"}`;

  const { data: row, error } = await db.from("support_messages").insert({ user_id: user.id, body: text }).select("id, body, from_admin, admin_name, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tgId = await sendToAdmins(
    `💬 <b>${tgEscape(who)}</b>\n${tgEscape(profile.email)}${profile.status === "frozen" ? " · սառեցված հաշիվ" : ""}\n\n${tgEscape(text)}\n\n<i>Պատասխանելու համար՝ Reply այս հաղորդագրությանը։</i>`
  );
  if (tgId) await db.from("support_messages").update({ tg_message_id: tgId }).eq("id", (row as { id: number }).id);
  else if (!telegramReady() && ownerInbox()) {
    await sendEmail({
      to: ownerInbox(),
      replyTo: profile.email,
      subject: `Culmen. օգնության չաթ՝ ${who}`,
      text: `${who}\n${profile.email}\n\n${text}`,
      html: `<p><b>${tgEscape(who)}</b><br>${tgEscape(profile.email)}</p><p>${tgEscape(text).replace(/\n/g, "<br>")}</p>`,
    });
  }
  return NextResponse.json({ ok: true, message: row });
}

export const POST = withErrorReport("support", handlePOST);
