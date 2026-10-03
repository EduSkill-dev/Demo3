// Server-only email sending through Resend's REST API (no SDK dependency).
//
//   RESEND_API_KEY   required to actually send — see README
//   EMAIL_FROM       optional, defaults to Resend's test sender
//
// Without a key every call is a no-op that reports `skipped`, so the app
// keeps working before the credentials exist. Never import this from a
// "use client" file.

import { CANCEL_WINDOW_HOURS, formatAmd } from "@/lib/catalog";

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

const BRAND = { pine: "#2b3d33", apricot: "#e2792b", stone: "#f7f4ee" };

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:${BRAND.stone};font-family:Georgia,serif;color:#26221d">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="font-size:20px;font-weight:700;color:${BRAND.pine}">🏔️ Highland</div>
    <div style="background:#fff;border:1px solid #ece5d6;border-radius:14px;padding:22px;margin-top:16px">
      <h1 style="margin:0 0 14px;font-size:20px;color:${BRAND.pine}">${title}</h1>
      ${bodyHtml}
      <p style="margin-top:22px;font-size:13px;color:#7a736a">
        Այս նամակն ուղարկվել է հարթակից՝ Highland, Հայաստանի արշավական ակումբների հարթակ։
      </p>
    </div>
  </div>
</body></html>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:5px 0;color:#7a736a">${label}</td>
          <td style="padding:5px 0;text-align:right;font-weight:600">${value}</td></tr>`;
}

function table(rows: string): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>`;
}

function button(href: string, text: string): string {
  return `<p style="margin-top:18px"><a href="${href}"
    style="display:inline-block;background:${BRAND.apricot};color:#fff;padding:11px 18px;border-radius:9px;text-decoration:none;font-weight:600;font-family:sans-serif">
    ${text}</a></p>`;
}

// User-typed text goes into HTML emails escaped.
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const BASE_URL = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function emailStatus(result: SendResult): "sent" | "skipped" | "failed" {
  if (result.ok) return "sent";
  return result.skipped ? "skipped" : "failed";
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (typeof window !== "undefined") {
    return { ok: false, skipped: false, error: "sendEmail must run on the server" };
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, reason: "RESEND_API_KEY not set" };
  if (!input.to) return { ok: false, skipped: true, reason: "no recipient" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Highland <onboarding@resend.dev>",
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, skipped: false, error: `${res.status} ${body.slice(0, 300)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id ?? null };
  } catch (e) {
    return { ok: false, skipped: false, error: (e as Error).message };
  }
}

/* ---------------------------------------------------------------- templates */

export function bookingConfirmationEmail(input: {
  to: string;
  firstName: string | null;
  tourTitle: string;
  date: string;
  clubName: string;
  meetingPoint: string | null;
  meetingTime: string | null;
}) {
  const rows = [
    row("Արշավ", input.tourTitle),
    row("Ամսաթիվ", input.date),
    row("Ակումբ", input.clubName),
    input.meetingPoint ? row("Հավաքի վայր", input.meetingPoint) : "",
    input.meetingTime ? row("Հավաքի ժամ", input.meetingTime.slice(0, 5)) : "",
    row("Չեղարկում", `մինչև ${CANCEL_WINDOW_HOURS} ժամ առաջ`),
  ].join("");

  const html = layout(
    "Գրանցումդ հաստատված է",
    `<p>Բարև ${input.firstName ?? ""}, դու գրանցվել ես արշավին։</p>${table(rows)}
     ${button(`${BASE_URL()}/tours`, "Տեսնել արշավները")}`
  );
  return {
    to: input.to,
    subject: `Գրանցումդ հաստատված է՝ ${input.tourTitle}`,
    html,
    text: `Գրանցումդ հաստատված է։ ${input.tourTitle} · ${input.date} · ${input.clubName}`,
  };
}

export function bookingCancelledEmail(input: {
  to: string;
  tourTitle: string;
  date: string;
  clubName: string;
}) {
  const html = layout(
    "Գրանցումդ չեղարկվեց",
    `<p>Քո գրանցումը «${input.tourTitle}» արշավին չեղարկվել է։</p>
     ${table([row("Ամսաթիվ", input.date), row("Ակումբ", input.clubName)].join(""))}
     ${button(`${BASE_URL()}/tours`, "Գտնել նոր արշավ")}`
  );
  return {
    to: input.to,
    subject: `Գրանցումը չեղարկվեց՝ ${input.tourTitle}`,
    html,
    text: `Գրանցումդ չեղարկվեց՝ ${input.tourTitle} (${input.date})`,
  };
}

export function newTourEmail(input: {
  to: string;
  clubName: string;
  tourTitle: string;
  date: string;
  regions: string[];
}) {
  const html = layout(
    `Նոր արշավ՝ ${input.clubName}`,
    `<p>Ակումբը, որին դու հետևում ես, հրապարակեց նոր արշավ։</p>
     ${table(
       [row("Արշավ", input.tourTitle), row("Ամսաթիվ", input.date), row("Մարզեր", input.regions.join(", ") || "—")].join("")
     )}
     ${button(`${BASE_URL()}/tours`, "Տեսնել արշավը")}`
  );
  return {
    to: input.to,
    subject: `Նոր արշավ ${input.clubName}-ից՝ ${input.tourTitle}`,
    html,
    text: `Նոր արշավ՝ ${input.tourTitle} (${input.date}) — ${input.clubName}`,
  };
}

export function paymentReceiptEmail(input: {
  to: string;
  kind: "booking" | "subscription";
  label: string;
  amount: number;
  cardLast4: string | null;
  status: "succeeded" | "declined";
}) {
  const ok = input.status === "succeeded";
  const html = layout(
    ok ? "Վճարումն ընդունված է" : "Վճարումը չանցավ",
    `<p>${ok ? "Շնորհակալություն։" : "Վճարումը մերժվել է թեստային գործիքով։"}</p>
     ${table(
       [
         row("Տեսակ", input.kind === "subscription" ? "Ակումբի բաժանորդագրություն" : "Արշավի գրանցում"),
         row("Առարկա", input.label),
         row("Գումար", formatAmd(input.amount)),
         row("Քարտ", input.cardLast4 ? `•••• ${input.cardLast4}` : "—"),
         row("Կարգավիճակ", ok ? "Հաջող" : "Մերժված"),
       ].join("")
     )}
     <p style="margin-top:14px;font-size:13px;color:#a1500f;background:#fdf1e6;padding:9px;border-radius:8px">
       Սա թեստային վճարում է՝ իրական գումար չի գանձվում։
     </p>`
  );
  return {
    to: input.to,
    subject: `${ok ? "Վճարումն ընդունված է" : "Վճարումը մերժվեց"}՝ ${input.label}`,
    html,
    text: `Վճարում (${input.status}): ${input.label} — ${input.amount} AMD`,
  };
}

export function newsletterConfirmEmail(input: { to: string; confirmUrl: string; unsubscribeUrl: string }) {
  const html = layout(
    "Հաստատեք բաժանորդագրությունը",
    `<p>Ցանկանո՞ւմ եք ստանալ նամակներ Highland-ի նոր արշավների և նորությունների մասին։ Սեղմեք ստորև կոճակը՝ հաստատելու համար։</p>
    ${button(input.confirmUrl, "Հաստատել բաժանորդագրությունը")}
    <p style="font-size:13px;color:#7a736a">Եթե դուք չեք բաժանորդագրվել, պարզապես անտեսեք այս նամակը կամ
    <a href="${input.unsubscribeUrl}" style="color:#7a736a">չեղարկեք այն</a>։</p>`
  );
  return {
    to: input.to,
    subject: "Highland — հաստատեք բաժանորդագրությունը",
    html,
    text: `Հաստատեք բաժանորդագրությունը՝ ${input.confirmUrl}`,
  };
}

export function contactInboxEmail(input: { to: string; message: string; email: string | null; phone: string | null }) {
  const rows = [
    input.email ? row("Էլ. հասցե", esc(input.email)) : "",
    input.phone ? row("Հեռախոս", esc(input.phone)) : "",
  ].join("");
  const html = layout(
    "Նոր առաջարկ կայքից",
    `${table(rows)}<p style="white-space:pre-line;margin-top:14px">${esc(input.message)}</p>`
  );
  return {
    to: input.to,
    subject: "Highland — նոր առաջարկ",
    html,
    text: `${input.message}

${input.email ?? ""} ${input.phone ?? ""}`,
  };
}
