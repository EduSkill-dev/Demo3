import { withErrorReport } from "@/lib/errors";
import { tooMany } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBlocked } from "@/lib/admin";

// Asked by the "forgot password" page before it requests a reset link: a
// blocked account gets no link — it is told so on the page and by email.
// An address of an admin with a security key gets no link either: such a
// password changes only inside the admin area, or the way back in is a
// recovery code ({ recovery: true }).
// Everything else answers { blocked: false }, whether or not the address has
// an account, so the page cannot be used to find out who is registered.
async function handlePOST(req: Request) {
  const limited = await tooMany(req, "forgot", 10, 60);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ blocked: false });

  const db = createAdminClient();
  const { data } = await db.from("profiles").select("id, status").eq("email", email).maybeSingle();
  const p = data as { id: string; status: string } | null;
  const { data: alt } = p ? { data: null } : await db.from("admins").select("user_id").eq("alt_email", email).maybeSingle();
  const holder = p?.id ?? (alt as { user_id: string } | null)?.user_id;
  if (holder) {
    const { count } = await db.from("admin_keys").select("id", { count: "exact", head: true }).eq("user_id", holder);
    if (count) return NextResponse.json({ blocked: false, recovery: true });
  }
  if (p?.status !== "blocked") return NextResponse.json({ blocked: false });

  await notifyBlocked(p.id);
  return NextResponse.json({ blocked: true });
}

// A crash or a 5xx answer here is logged and the admins are told.
export const POST = withErrorReport("auth", handlePOST);
