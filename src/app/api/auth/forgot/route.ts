import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBlocked } from "@/lib/admin";

// Asked by the "forgot password" page before it requests a reset link: a
// blocked account gets no link — it is told so on the page and by email.
// Everything else answers { blocked: false }, whether or not the address has
// an account, so the page cannot be used to find out who is registered.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ blocked: false });

  const { data } = await createAdminClient().from("profiles").select("id, status").eq("email", email).maybeSingle();
  const p = data as { id: string; status: string } | null;
  if (p?.status !== "blocked") return NextResponse.json({ blocked: false });

  await notifyBlocked(p.id);
  return NextResponse.json({ blocked: true });
}
