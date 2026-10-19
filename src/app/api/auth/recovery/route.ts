import { withErrorReport } from "@/lib/errors";
import { tooMany } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, logActivity } from "@/lib/admin";
import { deviceLabel, normalizeCode, sessionFor, setVia, trustDevice } from "@/lib/adminSecurity";
import { adminSecurityAlertEmail, sendEmail } from "@/lib/email";

// The super admin's way in when everything else fails: either address plus
// one of the ten recovery codes. It works even when both passwords were
// changed, the address is locked for 30 minutes, or the key is lost:
//   * every other session of the account ends (whoever got in is out),
//   * this device becomes trusted (no key asked),
//   * the 30-minute locks are lifted and both addresses are told by email.
// Few tries: 5 an hour from one address, 10 an hour for the account.
async function handlePOST(req: Request) {
  const limited = await tooMany(req, "recovery", 5, 60);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const code = normalizeCode(body.code ?? "");
  const wrong = () => NextResponse.json({ error: "Հասցեն կամ կոդը սխալ է։" }, { status: 400 });
  if (!email || !code) return wrong();

  const db = createAdminClient();
  const { data: byMain } = await db.from("profiles").select("id, email").eq("email", email).eq("role", "admin").maybeSingle();
  const { data: byAlt } = byMain ? { data: null } : await db.from("admins").select("user_id").eq("alt_email", email).maybeSingle();
  const userId = (byMain as { id: string } | null)?.id ?? (byAlt as { user_id: string } | null)?.user_id ?? null;
  if (!userId) return wrong();

  const { data: hit } = await db.rpc("hit_rate_limit", { p_key: `recovery-account:${userId}`, p_max: 10, p_minutes: 60 });
  if (hit === true) return NextResponse.json({ error: "Չափազանց շատ փորձեր։ Փորձեք մեկ ժամից։" }, { status: 429 });

  const { data: ok } = await db.rpc("admin_use_recovery_code", { p_user: userId, p_code: code });
  if (ok !== true) {
    await logActivity({ actor: userId, action: "security.recovery_failed", ip: clientIp(req) });
    return wrong();
  }

  const [{ data: owner }, { data: row }] = await Promise.all([
    db.from("profiles").select("email").eq("id", userId).maybeSingle(),
    db.from("admins").select("alt_email, blocked").eq("user_id", userId).maybeSingle(),
  ]);
  const main = (owner as { email: string } | null)?.email ?? "";
  const a = row as { alt_email: string | null; blocked: boolean } | null;
  if (a?.blocked) return NextResponse.json({ error: "Հաշիվն արգելափակված է։" }, { status: 403 });

  await db.rpc("end_user_sessions", { p_user: userId });
  await db.from("admin_devices").update({ revoked: true }).eq("user_id", userId);
  if (!(await sessionFor(db, main))) return NextResponse.json({ error: "Մուտքը չստացվեց։ Փորձեք նորից։" }, { status: 500 });
  await setVia(userId, byMain ? "main" : "alt");
  await trustDevice(db, userId, deviceLabel(req));
  await db.from("admins").update({ login_failures: 0, locked_until: null, alt_login_failures: 0, alt_locked_until: null }).eq("user_id", userId);

  const { count } = await db.from("admin_recovery_codes").select("id", { count: "exact", head: true }).eq("user_id", userId).is("used_at", null);
  await logActivity({ actor: userId, action: "security.recovery_login", ip: clientIp(req), meta: { left: count ?? 0 } });
  const what = `Մուտք մեկանգամյա կոդով (${email})։ Մնացել է ${count ?? 0} կոդ։ Մյուս բոլոր սարքերից հաշիվը դուրս է եկել, և դրանք կրկին պետք է հաստատվեն բանալիով։`;
  for (const to of [main, a?.alt_email]) if (to) await sendEmail(adminSecurityAlertEmail({ to, what, ip: clientIp(req) }));

  return NextResponse.json({ ok: true, target: "/admin/password", left: count ?? 0 });
}

// A crash or a 5xx answer here is logged and the admins are told.
export const POST = withErrorReport("auth", handlePOST);
