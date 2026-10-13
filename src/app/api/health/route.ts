import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// What the watchdog asks every 5 minutes (database job "culmen-watch"):
// 200 = the site runs and reaches its database; anything else = an outage.
// Says nothing about the site beyond that.
export async function GET() {
  try {
    const { error, count } = await createAdminClient().from("packages").select("id", { count: "exact", head: true });
    if (error || !count) return NextResponse.json({ ok: false, check: "database" }, { status: 503 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, check: "site" }, { status: 503 });
  }
}
