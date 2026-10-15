// Server-only: what people write to the platform — help-chat messages and
// suggestions — and the admins' answers, wherever they are written (the
// admin area or Reply in the Telegram groups). Both sides stay in step: an
// answer from the site is posted into the group as well, and the person's
// post in the group is marked "✅ answered by …" whichever way it came.
import type { createAdminClient } from "@/lib/supabase/admin";
import { editInGroup, sendToGroup, suggestionsChatId, telegramChatId, tgEscape } from "@/lib/telegram";
import { sendEmail, suggestionReplyEmail } from "@/lib/email";

type Db = ReturnType<typeof createAdminClient>;
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const answered = (name: string, via: "site" | "telegram") => `\n\n✅ <b>Պատասխանեց՝ ${tgEscape(name)}</b>${via === "site" ? " (կայքից)" : ""}`;

/* ------------------------------------------------------------- help chat */

export type SupportAuthor = { who: string; email: string; frozen: boolean };

export async function supportAuthor(db: Db, userId: string): Promise<SupportAuthor | null> {
  const { data: p } = await db.from("profiles").select("role, status, first_name, last_name, email").eq("id", userId).maybeSingle();
  const profile = p as { role: string; status: string; first_name: string | null; last_name: string | null; email: string } | null;
  if (!profile) return null;
  const { data: club } = profile.role === "club" ? await db.from("clubs").select("name").eq("owner_id", userId).maybeSingle() : { data: null };
  const person = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const who = profile.role === "club" ? `Ակումբ «${(club as { name?: string } | null)?.name ?? "—"}»${person ? ` (${person})` : ""}` : `Անհատ ${person || "—"}`;
  return { who, email: profile.email, frozen: profile.status === "frozen" };
}

// The person's question as the bot posts it in "Culmen Support".
export function supportPostHtml(a: SupportAuthor, text: string, answeredBy?: { name: string; via: "site" | "telegram" }) {
  return (
    `💬 <b>${tgEscape(a.who)}</b>\n${tgEscape(a.email)}${a.frozen ? " · սառեցված հաշիվ" : ""}\n\n${tgEscape(text)}` +
    (answeredBy ? answered(answeredBy.name, answeredBy.via) : `\n\n<i>Պատասխանելու համար՝ Reply այս հաղորդագրությանը։</i>`)
  );
}

// An admin answers someone's help chat. The questions still waiting are
// marked answered in the group; an answer written on the site is posted
// there too, under the last question.
export async function answerSupport(db: Db, input: { userId: string; adminName: string; body: string; via: "site" | "telegram"; tgMessageId?: number | null }) {
  const { data: rows } = await db
    .from("support_messages")
    .select("id, from_admin, body, tg_message_id")
    .eq("user_id", input.userId)
    .order("id", { ascending: false })
    .limit(30);
  const recent = (rows ?? []) as { id: number; from_admin: boolean; body: string; tg_message_id: number | null }[];
  const waiting = [];
  for (const r of recent) {
    if (r.from_admin) break;
    waiting.push(r);
  }

  let tgId = input.tgMessageId ?? null;
  if (input.via === "site") {
    const lastQuestion = recent.find((r) => !r.from_admin && r.tg_message_id);
    tgId = await sendToGroup(telegramChatId(), `🌐 <b>${tgEscape(input.adminName)}</b> (կայքից)\n\n${tgEscape(input.body)}`, lastQuestion?.tg_message_id ?? null);
  }
  const { error } = await db.from("support_messages").insert({
    user_id: input.userId, from_admin: true, admin_name: input.adminName, body: input.body.slice(0, 1000), tg_message_id: tgId, via: input.via,
  });
  if (error) return { error: error.message };

  const author = await supportAuthor(db, input.userId);
  if (author) {
    for (const q of waiting) {
      if (q.tg_message_id) await editInGroup(telegramChatId(), q.tg_message_id, supportPostHtml(author, q.body, { name: input.adminName, via: input.via }));
    }
    // The person may have left the page: tell them by email (no content).
    await sendEmail({
      to: author.email,
      subject: "Culmen. Ձեր հարցին պատասխանել են",
      text: `Հարթակի ադմինիստրատորը պատասխանել է Ձեր հարցին։ Պատասխանը կարդացեք այստեղ՝ ${site()}/help`,
      html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#12332D"><p>Հարթակի ադմինիստրատորը պատասխանել է Ձեր հարցին։</p><p><a href="${site()}/help" style="display:inline-block;background:#1E5B4F;color:#fff;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:999px">Կարդալ պատասխանը</a></p></div>`,
    });
  }
  return { ok: true as const };
}

/* ----------------------------------------------------------- suggestions */

type Suggestion = { id: string; message: string; email: string | null; phone: string | null; tg_message_id: number | null };

export function suggestionPostHtml(s: Suggestion, answeredBy?: { name: string; via: "site" | "telegram" }) {
  const contact = [s.email, s.phone].filter(Boolean).map((x) => tgEscape(x!)).join(" · ");
  return (
    `💡 <b>Նոր առաջարկ</b>\n${contact}\n\n${tgEscape(s.message)}` +
    (answeredBy ? answered(answeredBy.name, answeredBy.via) : `\n\n<i>Պատասխանելու համար՝ Reply այս հաղորդագրությանը (կուղարկվի նամակով)։</i>\n<a href="${site()}/admin/messages?s=${s.id}">Բացել կայքում</a>`)
  );
}

// A suggestion was confirmed: the admins' group hears of it once.
export async function announceSuggestion(db: Db, id: string) {
  const { data } = await db.from("contact_messages").select("id, message, email, phone, tg_message_id").eq("id", id).maybeSingle();
  const s = data as Suggestion | null;
  if (!s || s.tg_message_id) return;
  const tgId = await sendToGroup(suggestionsChatId(), suggestionPostHtml(s));
  if (tgId) await db.from("contact_messages").update({ tg_message_id: tgId }).eq("id", id);
}

// An admin answers a suggestion: the answer goes to its author by email, is
// kept, and the group sees it (posted, if written on the site) and the
// suggestion marked answered.
export async function answerSuggestion(db: Db, input: { id: string; adminName: string; body: string; via: "site" | "telegram"; tgMessageId?: number | null }) {
  const { data } = await db.from("contact_messages").select("id, message, email, phone, tg_message_id").eq("id", input.id).maybeSingle();
  const s = data as Suggestion | null;
  if (!s) return { error: "Առաջարկը չի գտնվել։" };
  if (!s.email) return { error: "Առաջարկի հեղինակը էլ. հասցե չի թողել։" };

  const mail = await sendEmail(suggestionReplyEmail({ to: s.email, reply: input.body }));
  if (mail && typeof mail === "object" && "error" in mail && mail.error) return { error: `Նամակը չուղարկվեց՝ ${String(mail.error)}` };

  let tgId = input.tgMessageId ?? null;
  if (input.via === "site") tgId = await sendToGroup(suggestionsChatId(), `🌐 <b>${tgEscape(input.adminName)}</b> (կայքից)\n\n${tgEscape(input.body)}`, s.tg_message_id);
  const { error } = await db.from("contact_replies").insert({ message_id: s.id, admin_name: input.adminName, body: input.body.slice(0, 4000), via: input.via, tg_message_id: tgId });
  if (error) return { error: error.message };
  if (s.tg_message_id) await editInGroup(suggestionsChatId(), s.tg_message_id, suggestionPostHtml(s, { name: input.adminName, via: input.via }));
  return { ok: true as const };
}

// The name an admin's answers are signed with: their name, else the part of
// their email before "@".
export async function adminDisplayName(db: Db, userId: string, email: string) {
  const { data } = await db.from("profiles").select("first_name, last_name").eq("id", userId).maybeSingle();
  const p = data as { first_name: string | null; last_name: string | null } | null;
  return [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || email.split("@")[0] || "Ադմինիստրատոր";
}
