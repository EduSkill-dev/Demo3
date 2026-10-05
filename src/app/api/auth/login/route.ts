import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, logActivity } from "@/lib/admin";

// Sign-in goes through the server so that
//   * every successful sign-in is logged with its IP address,
//   * an admin can use either of the two addresses tied to the account
//     (same password), and
//   * a blocked account is turned away even before its ban is noticed.
// The session cookie is set by the server client.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: { code: "invalid_credentials", message: "", status: 400 } }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  let result = await supabase.auth.signInWithPassword({ email, password });
  let via: "primary" | "alt" = "primary";

  // Not an account address: it may be an admin's second one.
  if (result.error?.code === "invalid_credentials") {
    const { data: alias } = await admin.from("admins").select("user_id").eq("alt_email", email).maybeSingle();
    const aliasId = (alias as { user_id: string } | null)?.user_id;
    if (aliasId) {
      const { data: owner } = await admin.from("profiles").select("email").eq("id", aliasId).maybeSingle();
      const primary = (owner as { email: string } | null)?.email;
      if (primary) {
        result = await supabase.auth.signInWithPassword({ email: primary, password });
        via = "alt";
      }
    }
  }

  if (result.error || !result.data.user) {
    const e = result.error;
    return NextResponse.json(
      { error: { code: e?.code ?? "invalid_credentials", message: e?.message ?? "", status: e?.status ?? 400 } },
      { status: 400 }
    );
  }

  const user = result.data.user;
  const { data: profile } = await admin.from("profiles").select("role, status").eq("id", user.id).maybeSingle();
  const p = profile as { role: string; status: string } | null;
  if (p?.status === "blocked") {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json({ error: { code: "user_banned", message: "", status: 403 } }, { status: 403 });
  }

  await logActivity({
    actor: user.id,
    action: "auth.login",
    ip: clientIp(req),
    meta: via === "alt" ? { via: "second address" } : {},
  });

  const target = p?.role === "admin" ? "/admin" : p?.role === "club" ? "/dashboard" : "/account";
  return NextResponse.json({ ok: true, role: p?.role ?? null, target });
}
