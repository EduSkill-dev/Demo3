// Cloudflare Email Worker. A letter to …@bolbol.am arrives here; its text
// (plain, or the HTML made plain) and addresses are posted to the site,
// which keeps it if it answers one of our letters (reply-<token>@…) and
// drops it otherwise. Nothing is stored here and nothing is forwarded.
import PostalMime from "postal-mime";

const MAX_BYTES = 512 * 1024; // a reply, not an archive

function plain(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default {
  async email(message, env) {
    if (message.rawSize > MAX_BYTES) {
      message.setReject("Message too large");
      return;
    }
    const raw = await new Response(message.raw).arrayBuffer();
    const mail = await PostalMime.parse(raw);
    const text = (mail.text && mail.text.trim()) || (mail.html ? plain(mail.html) : "");
    const res = await fetch(`${env.SITE_URL}/api/mail/inbound`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-mail-secret": env.MAIL_INBOUND_SECRET },
      // from: the letter's From header (what people see); envelope: the sender the
      // mail server gave (some services put a technical address there).
      body: JSON.stringify({ to: message.to, from: (mail.from && mail.from.address) || message.from, envelope: message.from, subject: mail.subject || "", text: text.slice(0, 20000) }),
    });
    if (!res.ok) throw new Error(`site answered ${res.status}`); // Cloudflare retries later
  },
};
