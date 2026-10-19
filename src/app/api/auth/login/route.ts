import { withErrorReport } from "@/lib/errors";
import { tooMany } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, logActivity } from "@/lib/admin";

// Sign-in goes through the server so that
//   * every successful sign-in is logged with its IP address,
//   * the super admin can use either of the two addresses tied to the
//     account (same password),
//   * a blocked account is turned away even before its ban is noticed, and
//   * admins are guarded: an admin the super admin blocked cannot sign in;
//     5 wrong passwords in a row lock a regular admin until the super admin
//     gives a new one-time password, and lock one of the super admin's two
//     addresses for 30 minutes (the other keeps working).
// The session cookie is set by the server client.
async function handlePOST(req: Request) {
  const limited = await tooMany(req, "login", 30, 10);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password || email.length > 254 || password.length > 200) {
    return NextResponse.json({ error: { code: "invalid_credentials", message: "", status: 400 } }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const fail = (code: string, status = 403) => NextResponse.json({ error: { code, message: "", status } }, { status });

  // Is this address an admin's (the main one, or the super admin's second)?
  const { data: byMain } = await admin.from("profiles").select("id").eq("email", email).eq("role", "admin").maybeSingle();
  const { data: byAlt } = byMain ? { data: null } : await admin.from("admins").select("user_id").eq("alt_email", email).maybeSingle();
  const adminId = (byMain as { id: string } | null)?.id ?? (byAlt as { user_id: string } | null)?.user_id ?? null;
  const which: "main" | "alt" = byMain ? "main" : "alt";
  type Guard = { is_super: boolean; blocked: boolean; locked: boolean; login_failures: number; locked_until: string | null; alt_login_failures: number; alt_locked_until: string | null };
  const { data: guardRow } = adminId
    ? await admin.from("admins").select("is_super, blocked, locked, login_failures, locked_until, alt_login_failures, alt_locked_until").eq("user_id", adminId).maybeSingle()
    : { data: null };
  const guard = guardRow as Guard | null;
  if (guard) {
    if (guard.blocked) return fail("admin_blocked");
    if (!guard.is_super && guard.locked) return fail("admin_locked");
    const until = which === "alt" ? guard.alt_locked_until : guard.locked_until;
    if (guard.is_super && until && new Date(until) > new Date()) return fail("admin_locked_temp");
  }

  let result = await supabase.auth.signInWithPassword({ email, password });
  let via: "primary" | "alt" = "primary";

  // Not an account address: it may be the super admin's second one.
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

  if (guard && adminId) {
    // Count wrong passwords for this address; a right one starts the count again.
    const field = which === "alt" ? "alt_login_failures" : "login_failures";
    if (result.error || !result.data.user) {
      const failures = (which === "alt" ? guard.alt_login_failures : guard.login_failures) + 1;
      const patch: Record<string, unknown> = { [field]: failures >= 5 ? 0 : failures };
      if (failures >= 5) {
        if (guard.is_super) patch[which === "alt" ? "alt_locked_until" : "locked_until"] = new Date(Date.now() + 30 * 60_000).toISOString();
        else patch.locked = true;
      }
      await admin.from("admins").update(patch).eq("user_id", adminId);
      if (failures >= 5) {
        await logActivity({ actor: adminId, action: "security.admin_locked", ip: clientIp(req), meta: { address: which, minutes: guard.is_super ? 30 : null } });
        return fail(guard.is_super ? "admin_locked_temp" : "admin_locked");
      }
    } else {
      await admin.from("admins").update({ [field]: 0 }).eq("user_id", adminId);
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

// A crash or a 5xx answer here is logged and the admins are told.
export const POST = withErrorReport("auth", handlePOST);
