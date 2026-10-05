import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, inactiveAccountError, logActivity } from "@/lib/admin";
import { deleteIndividual } from "@/lib/accountDeletion";

// "Delete my account" for individuals; see deleteIndividual for what happens
// to their bookings. A frozen account cannot delete itself.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const inactive = await inactiveAccountError(auth.user.id);
  if (inactive) return NextResponse.json({ error: inactive }, { status: 403 });

  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", auth.user.id).single();
  const p = profile as { role: string; email: string } | null;
  if (p?.role !== "individual") {
    // A club's account owns tours and other people's bookings; that needs a
    // human decision, not a button.
    return NextResponse.json({ error: "Club accounts are deleted on request." }, { status: 403 });
  }

  // Logged first: afterwards there is no profile left to name the actor.
  await logActivity({
    actor: auth.user.id,
    action: "account.deleted",
    targetType: "account",
    targetId: auth.user.id,
    targetLabel: p.email,
    ip: clientIp(req),
  });

  const result = await deleteIndividual(auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cancelled: result.cancelled });
}
