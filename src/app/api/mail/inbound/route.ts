import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorReport } from "@/lib/errors";
import { receiveSuggestionMail } from "@/lib/messages";

// Letters to the domain, passed on by the email Worker (workers/mail-in)
// after Cloudflare Email Routing hands it one. Only reply-<token>@… means
// anything: the author of a suggestion answering our letter. The Worker
// proves itself with MAIL_INBOUND_SECRET. Unknown letters are dropped (200).
async function handlePOST(req: Request) {
  const secret = process.env.MAIL_INBOUND_SECRET;
  if (!secret || req.headers.get("x-mail-secret") !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { to?: unknown; from?: unknown; envelope?: unknown; text?: unknown };
  const to = typeof body.to === "string" ? body.to.toLowerCase() : "";
  const from = typeof body.from === "string" ? body.from : "";
  const envelope = typeof body.envelope === "string" ? body.envelope : "";
  const text = typeof body.text === "string" ? body.text : "";
  const token = to.match(/^reply-([0-9a-f]{32})@/)?.[1];
  if (!token || !from || !text) return NextResponse.json({ ok: true, ignored: true });
  const res = await receiveSuggestionMail(createAdminClient(), { token, from: [from, envelope], text });
  return NextResponse.json("error" in res ? { ok: true, ignored: res.error } : { ok: true });
}

export const POST = withErrorReport("contact", handlePOST);
