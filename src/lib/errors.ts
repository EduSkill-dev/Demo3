// Server-only: faults are written to error_log and the admins are emailed —
// once an hour per fault at most, so one broken thing is one email.
// Nothing here ever throws: reporting a fault must not cause another.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const ALERT_EVERY_MS = 60 * 60 * 1000;
const BROWSER_ALERT_EVERY_MS = 6 * 60 * 60 * 1000;

// What each part is called in the alert (Armenian: the admins read it).
export const ERROR_AREAS: Record<string, string> = {
  bookings: "Ամրագրում",
  payments: "Վճարում",
  auth: "Մուտք / գրանցում",
  requests: "Անհատական հայտեր",
  admin: "Ադմինի գործողություններ",
  newsletter: "Բաժանորդագրություն",
  contact: "Առաջարկների ձև",
  cron: "Ամենօրյա առաջադրանք",
  club: "Ակումբի գործիքներ",
  calendar: "Օրացույց",
  tours: "Արշավներ",
  account: "Հաշիվ",
  support: "Օգնության չաթ",
  news: "Նորությունների ալիք",
  page: "Էջի ցուցադրում",
  site: "Կայքի հասանելիություն",
};

export type ErrorSource = "server" | "browser" | "monitor";

const clean = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
// Ids and numbers differ between two reports of the same fault.
const signatureOf = (source: string, area: string, message: string) =>
  `${source}:${area}:${message.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<id>").replace(/\d+/g, "#").slice(0, 160)}`;

export async function reportError(input: {
  area: string;
  error: unknown;
  source?: ErrorSource;
  url?: string | null;
  userId?: string | null;
  detail?: string | null;
}): Promise<void> {
  if (building()) return;
  try {
    const source = input.source ?? "server";
    const err = input.error;
    const message = clean(err instanceof Error ? err.message : err, 500) || "Անհայտ սխալ";
    const detail = (input.detail ?? (err instanceof Error ? err.stack : null) ?? "").slice(0, 4000) || null;
    const signature = signatureOf(source, input.area, message);
    const db = createAdminClient();

    await db.from("error_log").insert({ source, area: input.area, message, detail, url: input.url ?? null, user_id: input.userId ?? null, signature });

    // One alert per fault per window.
    const every = source === "browser" ? BROWSER_ALERT_EVERY_MS : ALERT_EVERY_MS;
    const { data: last } = await db.from("error_alerts").select("last_sent").eq("signature", signature).maybeSingle();
    if (last && Date.now() - new Date((last as { last_sent: string }).last_sent).getTime() < every) return;
    await db.from("error_alerts").upsert({ signature, last_sent: new Date().toISOString() });

    const { data: emails } = await db.rpc("admin_emails");
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const where = ERROR_AREAS[input.area] ?? input.area;
    const lines = [
      `Բաժին՝ ${where}`,
      `Սխալ՝ ${message}`,
      input.url ? `Հասցե՝ ${input.url}` : "",
      source === "browser" ? "Աղբյուր՝ այցելուի բրաուզեր" : "Աղբյուր՝ սերվեր",
      "",
      `Մանրամասները՝ ${site}/admin/errors`,
      "Նույն սխալի մասին հաջորդ նամակը կգա ոչ շուտ, քան մեկ ժամից։",
    ].filter((l, i) => l !== "" || i === 4);
    const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#12332D">${lines
      .map((l) => (l ? `<p style="margin:0 0 6px">${l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p>` : "<br>"))
      .join("")}</div>`;
    for (const to of (emails ?? []) as string[]) {
      await sendEmail({ to, subject: `Culmen. սխալ՝ ${where}`, html, text: lines.join("\n") });
    }
  } catch {
    /* never throw from here */
  }
}

// Next.js signals some things by throwing — a redirect, "not found", and
// (while building) "this route cannot be prepared ahead of time". None of
// them is a fault: they carry a `digest` and must travel on untouched.
const isControlFlow = (e: unknown) => {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_") || digest === "DYNAMIC_SERVER_USAGE" || digest === "BAILOUT_TO_CLIENT_SIDE_RENDERING");
};
// Nothing that happens while the site is being built is a fault of the live site.
const building = () => process.env.NEXT_PHASE === "phase-production-build";

// Wraps a route handler: a crash, or an answer of 500 and above, is reported;
// the visitor gets a plain message instead of a broken page.
export function withErrorReport<A extends [Request, ...unknown[]]>(area: string, handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const url = (() => {
      try {
        return new URL(args[0].url).pathname;
      } catch {
        return null;
      }
    })();
    try {
      const res = await handler(...args);
      if (res.status >= 500) {
        const body = await res.clone().text().catch(() => "");
        await reportError({ area, error: `HTTP ${res.status}: ${clean(body, 300)}`, url });
      }
      return res;
    } catch (e) {
      if (isControlFlow(e)) throw e;
      await reportError({ area, error: e, url });
      return NextResponse.json({ error: "Սերվերի սխալ։ Փորձեք նորից մի փոքր ուշ։" }, { status: 500 });
    }
  };
}
