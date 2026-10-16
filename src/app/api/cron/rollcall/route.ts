import { withErrorReport } from "@/lib/errors";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRollcall } from "@/lib/rollcall";

export const dynamic = "force-dynamic";

// Every 5 minutes (pg_cron "culmen-rollcall"): the roll-call lists that are
// due, and the evening reminders. Only with "Authorization: Bearer $CRON_SECRET".
async function handleGET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await runRollcall(createAdminClient())) });
}

export const GET = withErrorReport("cron", handleGET);
