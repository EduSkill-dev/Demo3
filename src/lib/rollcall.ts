// Server-only: the roll call by Telegram (see 0068_rollcall.sql).
//   connect   — /start c_<code> in the bot: the person joins the club's list
//   send      — 10 min before the meeting time, each person named on the hike
//               gets the participants with ✅/❌ buttons
//   tap       — writes bookings.attended and updates every copy of the list
//   remind    — in the evening, if someone is still unmarked: the people on
//               the hike in Telegram, the club by email
import { createAdminClient } from "@/lib/supabase/admin";
import { botCall, tgEscape } from "@/lib/telegram";
import { sendEmail, rollcallReminderEmail } from "@/lib/email";

type Db = ReturnType<typeof createAdminClient>;

export const BOT_USERNAME = () => process.env.TELEGRAM_BOT_USERNAME || "culmen_support_bot";
export const joinLink = (code: string) => `https://t.me/${BOT_USERNAME()}?start=c_${code}`;

const LEAD_MINUTES = 10; // the list goes this long before the meeting time
const FALLBACK_TIME = 8 * 60; // a hike without a meeting time: 08:00
const REMIND_AT = 20 * 60; // the evening reminder, Yerevan time

// Yerevan has no daylight saving: UTC+4 all year.
function yerevanNow() {
  const d = new Date(Date.now() + 4 * 3600 * 1000);
  return { day: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
const minutesOf = (time: string | null) => {
  const m = time?.match(/^(\d{1,2}):(\d{2})/);
  return m ? +m[1] * 60 + +m[2] : FALLBACK_TIME;
};

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };

/* ------------------------------------------------------------- connect */

// "/start c_<code>" in a private chat with the bot.
export async function handleStart(db: Db, chatId: number, from: TgUser, payload: string): Promise<void> {
  const code = payload.startsWith("c_") ? payload.slice(2) : "";
  const { data: row } = code ? await db.from("club_tg_codes").select("club_id, clubs(name)").eq("code", code).maybeSingle() : { data: null };
  const club = row as { club_id: string; clubs: { name: string } | null } | null;
  if (!club) {
    await say(chatId, "Բարև։ Այս բոտով Culmen-ի ակումբները նշում են արշավների ներկա/բացական։ Միանալու համար բացեք ակումբի տված հղումը կամ QR կոդը։");
    return;
  }
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ").slice(0, 80) || from.username || "Telegram";
  await db.from("club_tg_people").upsert(
    { club_id: club.club_id, tg_user_id: from.id, chat_id: chatId, name, username: from.username ?? null },
    { onConflict: "club_id,tg_user_id" }
  );
  await say(
    chatId,
    `✅ Դուք միացաք <b>${tgEscape(club.clubs?.name ?? "")}</b> ակումբին՝ ներկա/բացակա նշելու համար։\n\nԵրբ ակումբը Ձեզ նշի արշավի հայտարարության մեջ, մեկնումից ${LEAD_MINUTES} րոպե առաջ այստեղ կստանաք մասնակիցների ցուցակը՝ կոճակներով։`
  );
}

async function say(chatId: number, html: string) {
  await botCall("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true });
}

/* ---------------------------------------------------------------- list */

type Tour = { id: string; title: string; date: string; meeting_time: string | null; meeting_point: string | null };
type Row = { id: string; seq: number; attended: boolean | null; profiles: { first_name: string | null; last_name: string | null; phone: string | null } | null };

async function participants(db: Db, tourId: string): Promise<Row[]> {
  const { data } = await db
    .from("bookings")
    .select("id, seq, attended, profiles(first_name, last_name, phone)")
    .eq("tour_id", tourId)
    .eq("status", "confirmed")
    .order("seq");
  return (data ?? []) as unknown as Row[];
}

const personName = (r: Row) => [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(" ") || "—";
const mark = (v: boolean | null) => (v === true ? "✅" : v === false ? "❌" : "⬜");

function render(tour: Tour, rows: Row[]) {
  const came = rows.filter((r) => r.attended === true).length;
  const absent = rows.filter((r) => r.attended === false).length;
  const lines = rows.map((r, i) => `${mark(r.attended)} ${i + 1}. ${tgEscape(personName(r))}${r.profiles?.phone ? ` · ${tgEscape(r.profiles.phone)}` : ""}`);
  const when = `${tour.date.slice(8, 10)}.${tour.date.slice(5, 7)}${tour.meeting_time ? ` · ⏰ ${tour.meeting_time.slice(0, 5)}` : ""}`;
  const html = [
    `<b>🥾 Ներկա/բացակա՝ ${tgEscape(tour.title)}</b>`,
    `📅 ${when}${tour.meeting_point ? ` · 📍 ${tgEscape(tour.meeting_point)}` : ""}`,
    "",
    ...lines,
    "",
    `Եկավ՝ ${came} · Չեկավ՝ ${absent} · Չնշված՝ ${rows.length - came - absent}`,
    "<i>Անվան վրա սեղմելով՝ «եկավ», ❌-ով՝ «չեկավ»։ Նույն կոճակը կրկին՝ նշումը հանվում է։</i>",
  ].join("\n");
  const keyboard = rows.map((r, i) => [
    { text: `${mark(r.attended)} ${i + 1}. ${personName(r)}`.slice(0, 60), callback_data: `rc:${r.id}:1` },
    { text: r.attended === false ? "❌ Չեկավ" : "❌", callback_data: `rc:${r.id}:0` },
  ]);
  return { html: html.slice(0, 4000), reply_markup: { inline_keyboard: keyboard } };
}

async function tourOf(db: Db, id: string): Promise<Tour | null> {
  const { data } = await db.from("tours").select("id, title, date, meeting_time, meeting_point").eq("id", id).maybeSingle();
  return data as Tour | null;
}

// Rewrites every copy of a hike's list after a mark.
async function refresh(db: Db, tourId: string) {
  const tour = await tourOf(db, tourId);
  if (!tour) return;
  const msg = render(tour, await participants(db, tourId));
  const { data } = await db.from("rollcall_messages").select("chat_id, message_id").eq("tour_id", tourId);
  await Promise.all(
    ((data ?? []) as { chat_id: number; message_id: number }[]).map((m) =>
      botCall("editMessageText", { chat_id: m.chat_id, message_id: m.message_id, text: msg.html, parse_mode: "HTML", reply_markup: msg.reply_markup })
    )
  );
}

/* ----------------------------------------------------------------- tap */

export async function handleTap(db: Db, q: { id: string; from: TgUser; data?: string }) {
  const m = q.data?.match(/^rc:([0-9a-f-]{36}):([01])$/);
  if (!m) return botCall("answerCallbackQuery", { callback_query_id: q.id });
  const [, bookingId, v] = m;
  const { data: b } = await db.from("bookings").select("tour_id, attended").eq("id", bookingId).maybeSingle();
  const booking = b as { tour_id: string; attended: boolean | null } | null;
  const wanted = v === "1";
  const next = booking?.attended === wanted ? null : wanted; // the same button again clears the mark
  const { data: res } = await db.rpc("rollcall_mark", { p_booking: bookingId, p_tg_user: q.from.id, p_attended: next });
  const answers: Record<string, string> = {
    ok: next === null ? "Նշումը հանվեց" : next ? "✅ Եկավ" : "❌ Չեկավ",
    forbidden: "Դուք նշված չեք այս արշավի ներկա/բացակա նշողների մեջ։",
    cancelled: "Այս հայտը չեղարկված է։",
    early: "Ներկայությունը նշվում է արշավի օրվանից։",
    missing: "Հայտը չի գտնվել։",
  };
  await botCall("answerCallbackQuery", { callback_query_id: q.id, text: answers[String(res)] ?? "Չստացվեց։" });
  if (res === "ok" && booking) await refresh(db, booking.tour_id);
}

/* -------------------------------------------------------- send, remind */

export async function runRollcall(db: Db): Promise<{ sent: number; reminded: number }> {
  const now = yerevanNow();
  let sent = 0;
  let reminded = 0;

  // Lists due: today's hikes from 10 minutes before the meeting time on.
  const { data: due } = await db
    .from("tours")
    .select("id, title, date, meeting_time, meeting_point")
    .eq("date", now.day)
    .eq("status", "active")
    .is("rollcall_sent_at", null);
  for (const tour of (due ?? []) as Tour[]) {
    if (now.minutes < minutesOf(tour.meeting_time) - LEAD_MINUTES) continue;
    const rows = await participants(db, tour.id);
    const { data: people } = await db.from("tour_rollcall").select("club_tg_people(id, chat_id)").eq("tour_id", tour.id);
    if (rows.length > 0) {
      const msg = render(tour, rows);
      for (const p of ((people ?? []) as unknown as { club_tg_people: { id: string; chat_id: number } | null }[]).map((x) => x.club_tg_people).filter(Boolean)) {
        const res = await botCall("sendMessage", { chat_id: p!.chat_id, text: msg.html, parse_mode: "HTML", reply_markup: msg.reply_markup });
        if (res?.ok && res.result?.message_id) {
          await db.from("rollcall_messages").insert({ tour_id: tour.id, person_id: p!.id, chat_id: p!.chat_id, message_id: res.result.message_id });
          sent++;
        }
      }
    }
    await db.from("tours").update({ rollcall_sent_at: new Date().toISOString() }).eq("id", tour.id);
  }

  // Evening: someone still unmarked → the people on the hike and the club.
  if (now.minutes >= REMIND_AT) {
    const { data: open } = await db
      .from("tours")
      .select("id, title, date, meeting_time, meeting_point, clubs(name, profiles!clubs_owner_id_fkey(email))")
      .eq("date", now.day)
      .not("rollcall_sent_at", "is", null)
      .is("rollcall_reminded_at", null);
    for (const tour of (open ?? []) as unknown as (Tour & { clubs: { name: string; profiles: { email: string } | null } | null })[]) {
      const rows = await participants(db, tour.id);
      const unmarked = rows.filter((r) => r.attended === null).length;
      if (unmarked > 0) {
        const { data: msgs } = await db.from("rollcall_messages").select("chat_id, message_id").eq("tour_id", tour.id);
        for (const m of (msgs ?? []) as { chat_id: number; message_id: number }[]) {
          await botCall("sendMessage", {
            chat_id: m.chat_id,
            text: `⏰ «${tgEscape(tour.title)}»․ ${unmarked} մասնակցի ներկայությունը դեռ նշված չէ։ Խնդրում ենք նշել վերևի ցուցակում։`,
            parse_mode: "HTML",
            reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true },
          });
        }
        const to = tour.clubs?.profiles?.email;
        if (to) await sendEmail(rollcallReminderEmail({ to, clubName: tour.clubs?.name ?? "", title: tour.title, tourId: tour.id, unmarked }));
        reminded++;
      }
      await db.from("tours").update({ rollcall_reminded_at: new Date().toISOString() }).eq("id", tour.id);
    }
  }
  return { sent, reminded };
}
