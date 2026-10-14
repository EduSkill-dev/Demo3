// Server-only: the platform's Telegram bot. It posts to the admins' group
// (help-chat messages; later, alerts) and the group's replies come back
// through /api/telegram/webhook.
//   TELEGRAM_BOT_TOKEN       the bot
//   TELEGRAM_CHAT_ID         the admins' group
//   TELEGRAM_WEBHOOK_SECRET  proves a webhook call really is from Telegram
// Without the first two nothing is sent and callers fall back to email.

export const telegramReady = () => !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
export const telegramChatId = () => process.env.TELEGRAM_CHAT_ID ?? "";

const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

// Posts to the admins' group. Returns the message id there, or null.
// `html` may use <b>, <i>, <a>; `plain` parts must be passed through tgEscape.
export async function sendToAdmins(html: string): Promise<number | null> {
  if (!telegramReady()) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: html.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: { message_id?: number } } | null;
    return json?.ok ? json.result?.message_id ?? null : null;
  } catch {
    return null;
  }
}

export const tgEscape = escapeHtml;
