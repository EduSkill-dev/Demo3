import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rateLimit";
import { reportError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// Noise that is not ours: browser extensions, blocked third-party scripts,
// a visitor's connection dropping.
const IGNORED = /ResizeObserver loop|^Script error\.?$|extension:\/\/|Load failed|Failed to fetch|NetworkError|AbortError|The operation was aborted/i;

// A page broke in a visitor's browser (src/components/ErrorReporter.tsx
// and the error screens send it here). A few per address, so nobody can
// fill the log.
export async function POST(req: Request) {
  const limited = await tooMany(req, "client-error", 10, 10);
  if (limited) return NextResponse.json({ ok: true });

  const body = (await req.json().catch(() => ({}))) as { message?: unknown; stack?: unknown; url?: unknown; digest?: unknown };
  const message = typeof body.message === "string" ? body.message.slice(0, 500) : "";
  if (!message || IGNORED.test(message)) return NextResponse.json({ ok: true });

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  await reportError({
    area: "page",
    source: "browser",
    error: message,
    detail: [typeof body.digest === "string" ? `digest: ${body.digest}` : "", typeof body.stack === "string" ? body.stack : ""].filter(Boolean).join("\n").slice(0, 4000) || null,
    url: typeof body.url === "string" ? body.url.slice(0, 300) : null,
    userId: user?.id ?? null,
  });
  return NextResponse.json({ ok: true });
}
