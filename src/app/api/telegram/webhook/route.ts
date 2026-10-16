import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorReport } from "@/lib/errors";
import { suggestionsChatId, telegramChatId } from "@/lib/telegram";
import { answerSuggestion, answerSupport, suggestionForPost } from "@/lib/messages";
import { handleStart, handleTap } from "@/lib/rollcall";

type TgFrom = { id: number; first_name?: string; last_name?: string; username?: string; is_bot?: boolean };
type Update = {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type?: string };
    from?: TgFrom;
    reply_to_message?: { message_id: number };
  };
  callback_query?: { id: string; from: TgFrom; data?: string };
};

// Telegram calls this for every message in the admins' groups. Only one kind
// matters: an admin's Reply to a post the bot made —
//   * in "Culmen Support", a person's help-chat question: the answer appears
//     in their chat on the site, signed with the admin's name;
//   * in "Culmen Suggestions", a suggestion or its author's later answer: the
//     answer is emailed to the author.
// Either way the post is marked answered. A reply to another admin's message
// is the admins talking among themselves and stays in the group.
// In private chats the bot serves the clubs' roll call (lib/rollcall): a
// /start with the club's code connects the person, a tap on a list's button
// marks attendance. Everything else is ignored (always with 200, or
// Telegram keeps resending).
async function handlePOST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const update = (await req.json().catch(() => ({}))) as Update;
  if (update.callback_query) {
    await handleTap(createAdminClient(), update.callback_query);
    return NextResponse.json({ ok: true });
  }
  const m = update.message;
  if (m?.chat.type === "private" && m.from && !m.from.is_bot) {
    const start = m.text?.trim().match(/^\/start(?:\s+(\S+))?/);
    await handleStart(createAdminClient(), m.chat.id, m.from, start?.[1] ?? "");
    return NextResponse.json({ ok: true });
  }
  const text = m?.text?.trim();
  if (!m || !text || m.from?.is_bot || !m.reply_to_message) return NextResponse.json({ ok: true });
  const chat = String(m.chat.id);
  const adminName = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ").slice(0, 80) || "Ադմինիստրատոր";
  const db = createAdminClient();

  if (chat === telegramChatId()) {
    const { data: original } = await db.from("support_messages").select("user_id").eq("tg_message_id", m.reply_to_message.message_id).eq("from_admin", false).limit(1).maybeSingle();
    const userId = (original as { user_id: string } | null)?.user_id;
    if (userId) await answerSupport(db, { userId, adminName, body: text, via: "telegram", tgMessageId: m.message_id });
  } else if (suggestionsChatId() && chat === suggestionsChatId()) {
    const id = await suggestionForPost(db, m.reply_to_message.message_id);
    if (id) await answerSuggestion(db, { id, adminName, body: text, via: "telegram", tgMessageId: m.message_id });
  }
  return NextResponse.json({ ok: true });
}

export const POST = withErrorReport("support", handlePOST);
