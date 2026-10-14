import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorReport } from "@/lib/errors";
import { sendEmail } from "@/lib/email";
import { telegramChatId } from "@/lib/telegram";

type Update = {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    from?: { first_name?: string; last_name?: string; is_bot?: boolean };
    reply_to_message?: { message_id: number };
  };
};

// Telegram calls this for every message in the admins' group. Only one kind
// matters: an admin's Reply to a help-chat message the bot posted. It
// becomes the answer in that person's chat on the site, signed with the
// admin's name. Everything else is ignored (always with 200, or Telegram
// keeps resending).
async function handlePOST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const update = (await req.json().catch(() => ({}))) as Update;
  const m = update.message;
  const text = m?.text?.trim();
  if (!m || !text || m.from?.is_bot || !m.reply_to_message || String(m.chat.id) !== telegramChatId()) return NextResponse.json({ ok: true });

  const db = createAdminClient();
  const { data: original } = await db.from("support_messages").select("user_id").eq("tg_message_id", m.reply_to_message.message_id).limit(1).maybeSingle();
  const userId = (original as { user_id: string } | null)?.user_id;
  if (!userId) return NextResponse.json({ ok: true });

  const adminName = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ").slice(0, 80) || "Ադմինիստրատոր";
  // The reply's own id is stored too, so an admin can also answer in a thread.
  await db.from("support_messages").insert({ user_id: userId, from_admin: true, admin_name: adminName, body: text.slice(0, 1000), tg_message_id: m.message_id });

  // The person may have left the page: tell them by email (one line, no content).
  const { data: p } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
  const email = (p as { email?: string } | null)?.email;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (email) {
    await sendEmail({
      to: email,
      subject: "Culmen. Ձեր հարցին պատասխանել են",
      text: `Հարթակի ադմինիստրատորը պատասխանել է Ձեր հարցին։ Պատասխանը կարդացեք այստեղ՝ ${site}/help`,
      html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#12332D"><p>Հարթակի ադմինիստրատորը պատասխանել է Ձեր հարցին։</p><p><a href="${site}/help" style="display:inline-block;background:#1E5B4F;color:#fff;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:999px">Կարդալ պատասխանը</a></p></div>`,
    });
  }
  return NextResponse.json({ ok: true });
}

export const POST = withErrorReport("support", handlePOST);
