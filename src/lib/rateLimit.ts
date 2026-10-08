// Server-only: how often one address may call an open endpoint. Counted in
// the database (rate_hits), so it holds across serverless instances.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/admin";

const LOCAL = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1"]);

// Returns the 429 answer to send when `action` was called more than `max`
// times in `minutes` from this address, otherwise null. Local development
// and callers without a visible address are not limited; a failing counter
// never blocks a request.
export async function tooMany(req: Request, action: string, max: number, minutes: number): Promise<NextResponse | null> {
  const ip = clientIp(req);
  if (!ip || LOCAL.has(ip)) return null;
  try {
    const { data } = await createAdminClient().rpc("hit_rate_limit", { p_key: `${action}:${ip}`, p_max: max, p_minutes: minutes });
    if (data === true) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Չափազանց շատ փորձեր։ Փորձեք մի փոքր ուշ։", status: 429 } },
        { status: 429 }
      );
    }
  } catch {
    // ignore
  }
  return null;
}
