import { withErrorReport } from "@/lib/errors";
import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, getAdmin, logActivity, type AdminSession } from "@/lib/admin";
import { tooMany } from "@/lib/rateLimit";
import { MIN_PASSWORD } from "@/lib/authErrors";
import { adminConfirmChangeEmail, adminSecurityAlertEmail, sendEmail } from "@/lib/email";
import {
  MAX_KEYS,
  allowCredentialChange,
  deviceTrusted,
  recoveredJustNow,
  deviceLabel,
  newRecoveryCodes,
  relyingParty,
  trustDevice,
  viaOf,
} from "@/lib/adminSecurity";

// An admin's sign-in protection (see 0074_admin_keys.sql, 0076):
//   register.*   add a security key (YubiKey), at most two; the first one
//                also makes the ten recovery codes, shown once
//   verify.*     a new device passes the key and becomes trusted
//   remove.*     remove a key: a touch of one of the keys, or — both lost —
//                within 30 minutes of a recovery-code sign-in on this device
//   device.revoke, codes.new
//   other.*      (super admin) change the OTHER address's password: the key, then a link
//                sent to that address, then the new password — all inside
//                10 minutes (SMS joins when there is a provider)
//   confirm      the link from that email (opened on any device)
// Only this route works for a device that has not passed the key yet, and
// only for verify.*.

type Db = ReturnType<typeof createAdminClient>;
type Body = Record<string, unknown>;
type Key = { id: string; credential_id: string; public_key: string; counter: number; transports: string[] | null };
type Ctx = { me: AdminSession; db: Db; req: Request; ip: string | null };

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const str = (v: unknown) => (typeof v === "string" ? v : "");
const NO_KEY = "Նախ հաստատեք այս սարքը անվտանգության բանալիով։";

async function keysOf(db: Db, userId: string): Promise<Key[]> {
  const { data } = await db.from("admin_keys").select("id, credential_id, public_key, counter, transports").eq("user_id", userId);
  return (data as Key[] | null) ?? [];
}

type Purpose = "register" | "verify" | "other" | "remove";
async function saveChallenge(db: Db, userId: string, purpose: Purpose, challenge: string) {
  await db.from("admin_challenges").delete().eq("user_id", userId).eq("purpose", purpose);
  await db.from("admin_challenges").insert({ user_id: userId, purpose, challenge });
}
// A challenge is used once.
async function takeChallenge(db: Db, userId: string, purpose: Purpose): Promise<string | null> {
  const { data } = await db
    .from("admin_challenges")
    .select("id, challenge, expires_at")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { id: string; challenge: string; expires_at: string } | null;
  if (!row) return null;
  await db.from("admin_challenges").delete().eq("id", row.id);
  return new Date(row.expires_at) > new Date() ? row.challenge : null;
}

async function authOptions(ctx: Ctx, purpose: Exclude<Purpose, "register">) {
  const keys = await keysOf(ctx.db, ctx.me.userId);
  const { rpID } = relyingParty(ctx.req);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "discouraged",
    allowCredentials: keys.map((k) => ({ id: k.credential_id, transports: (k.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined })),
  });
  await saveChallenge(ctx.db, ctx.me.userId, purpose, options.challenge);
  return options;
}

// True when the answer is a valid touch of one of this admin's keys.
async function keyTouched(ctx: Ctx, purpose: Exclude<Purpose, "register">, response: unknown): Promise<boolean> {
  const r = response as AuthenticationResponseJSON | null;
  if (!r || typeof r.id !== "string") return false;
  const expectedChallenge = await takeChallenge(ctx.db, ctx.me.userId, purpose);
  if (!expectedChallenge) return false;
  const key = (await keysOf(ctx.db, ctx.me.userId)).find((k) => k.credential_id === r.id);
  if (!key) return false;
  const { rpID, origin } = relyingParty(ctx.req);
  try {
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: r,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: key.credential_id,
        publicKey: isoBase64URL.toBuffer(key.public_key),
        counter: Number(key.counter),
        transports: (key.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
      },
    });
    if (!verified) return false;
    await ctx.db.from("admin_keys").update({ counter: authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", key.id);
    return true;
  } catch {
    return false;
  }
}

async function addresses(db: Db, me: AdminSession): Promise<{ main: string; alt: string | null }> {
  const { data } = await db.from("admins").select("alt_email").eq("user_id", me.userId).maybeSingle();
  return { main: me.email, alt: (data as { alt_email: string | null } | null)?.alt_email ?? null };
}

// Both addresses hear about every change in the protection.
async function alert(ctx: Ctx, what: string) {
  const { main, alt } = await addresses(ctx.db, ctx.me);
  for (const to of [main, alt]) if (to) await sendEmail(adminSecurityAlertEmail({ to, what, ip: ctx.ip }));
}

async function freshCodes(ctx: Ctx): Promise<string[]> {
  const codes = newRecoveryCodes();
  await ctx.db.rpc("admin_new_recovery_codes", { p_user: ctx.me.userId, p_codes: codes });
  return codes;
}

const ACTIONS: Record<string, (ctx: Ctx, body: Body) => Promise<NextResponse>> = {
  /* ------------------------------------------------------------ the gate */
  async "verify.options"(ctx) {
    if ((await keysOf(ctx.db, ctx.me.userId)).length === 0) return fail("Բանալի գրանցված չէ։");
    return NextResponse.json({ options: await authOptions(ctx, "verify") });
  },
  async "verify.verify"(ctx, body) {
    if (!(await keyTouched(ctx, "verify", body.response))) return fail("Բանալին չհաստատվեց։ Փորձեք նորից։");
    await trustDevice(ctx.db, ctx.me.userId, deviceLabel(ctx.req));
    await logActivity({ actor: ctx.me.userId, action: "security.device_trusted", ip: ctx.ip, meta: { device: deviceLabel(ctx.req) } });
    return NextResponse.json({ ok: true });
  },

  /* ------------------------------------------------------------ keys */
  async "register.options"(ctx) {
    const keys = await keysOf(ctx.db, ctx.me.userId);
    if (keys.length >= MAX_KEYS) return fail(`Կարելի է գրանցել առավելագույնը ${MAX_KEYS} բանալի։`);
    const { rpID, rpName } = relyingParty(ctx.req);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: ctx.me.email,
      userDisplayName: ctx.me.isSuper ? "Culmen — գլխավոր ադմին" : "Culmen — ադմին",
      userID: new TextEncoder().encode(ctx.me.userId),
      attestationType: "none",
      excludeCredentials: keys.map((k) => ({ id: k.credential_id, transports: (k.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined })),
      authenticatorSelection: { residentKey: "discouraged", userVerification: "discouraged" },
    });
    await saveChallenge(ctx.db, ctx.me.userId, "register", options.challenge);
    return NextResponse.json({ options });
  },
  async "register.verify"(ctx, body) {
    const expectedChallenge = await takeChallenge(ctx.db, ctx.me.userId, "register");
    if (!expectedChallenge) return fail("Ժամանակը սպառվեց։ Փորձեք նորից։");
    const { rpID, origin } = relyingParty(ctx.req);
    let info;
    try {
      const result = await verifyRegistrationResponse({
        response: body.response as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
      if (!result.verified) return fail("Բանալին չգրանցվեց։ Փորձեք նորից։");
      info = result.registrationInfo;
    } catch {
      return fail("Բանալին չգրանցվեց։ Փորձեք նորից։");
    }
    const existing = await keysOf(ctx.db, ctx.me.userId);
    if (existing.length >= MAX_KEYS) return fail(`Կարելի է գրանցել առավելագույնը ${MAX_KEYS} բանալի։`);
    const first = existing.length === 0;
    const label = str(body.label).trim().slice(0, 60) || "YubiKey";
    const { error } = await ctx.db.from("admin_keys").insert({
      user_id: ctx.me.userId,
      credential_id: info.credential.id,
      public_key: isoBase64URL.fromBuffer(info.credential.publicKey),
      counter: info.credential.counter,
      transports: info.credential.transports ?? null,
      label,
    });
    if (error) return fail(error.code === "23505" ? "Այս բանալին արդեն գրանցված է։" : error.message, 400);
    // The device that registered the key is trusted; the first key makes the codes.
    if (!(await deviceTrusted(ctx.db, ctx.me.userId))) await trustDevice(ctx.db, ctx.me.userId, deviceLabel(ctx.req));
    const { count } = await ctx.db.from("admin_recovery_codes").select("id", { count: "exact", head: true }).eq("user_id", ctx.me.userId).is("used_at", null);
    const codes = first || !count ? await freshCodes(ctx) : null;
    await logActivity({ actor: ctx.me.userId, action: "security.key_added", ip: ctx.ip, meta: { label } });
    await alert(ctx, `Ադմինի հաշվին ավելացվեց անվտանգության բանալի՝ «${label}»։`);
    return NextResponse.json({ ok: true, codes });
  },
  async "remove.options"(ctx) {
    if (await recoveredJustNow(ctx.db, ctx.me.userId)) return NextResponse.json({ options: null });
    return NextResponse.json({ options: await authOptions(ctx, "remove") });
  },
  async "key.remove"(ctx, body) {
    const keys = await keysOf(ctx.db, ctx.me.userId);
    const id = str(body.id);
    if (!keys.some((k) => k.id === id)) return fail("Բանալին չի գտնվել։", 404);
    if (!(await recoveredJustNow(ctx.db, ctx.me.userId)) && !(await keyTouched(ctx, "remove", body.response))) {
      return fail("Ջնջելու համար հպեք Ձեր բանալիներից մեկին։");
    }
    await ctx.db.from("admin_keys").delete().eq("id", id).eq("user_id", ctx.me.userId);
    await logActivity({ actor: ctx.me.userId, action: "security.key_removed", ip: ctx.ip });
    await alert(ctx, "Ադմինի հաշվից ջնջվեց անվտանգության բանալի։");
    return NextResponse.json({ ok: true });
  },
  async "device.revoke"(ctx, body) {
    await ctx.db.from("admin_devices").update({ revoked: true }).eq("id", str(body.id)).eq("user_id", ctx.me.userId);
    await logActivity({ actor: ctx.me.userId, action: "security.device_revoked", ip: ctx.ip });
    return NextResponse.json({ ok: true });
  },
  async "codes.new"(ctx) {
    if ((await keysOf(ctx.db, ctx.me.userId)).length === 0) return fail("Նախ գրանցեք բանալի։");
    const codes = await freshCodes(ctx);
    await logActivity({ actor: ctx.me.userId, action: "security.codes_renewed", ip: ctx.ip });
    await alert(ctx, "Ստեղծվեցին նոր մեկանգամյա կոդեր․ հները այլևս չեն գործում։");
    return NextResponse.json({ ok: true, codes });
  },

  /* ------------------------------------------- the other address's password */
  async "other.start"(ctx) {
    if ((await keysOf(ctx.db, ctx.me.userId)).length === 0) return fail("Նախ գրանցեք անվտանգության բանալի։");
    const { alt } = await addresses(ctx.db, ctx.me);
    if (!alt) return fail("Երկրորդ հասցե նշված չէ։");
    const target = (await viaOf(ctx.me.userId)) === "main" ? "alt" : "main";
    await ctx.db.from("admin_secure_ops").delete().eq("user_id", ctx.me.userId).is("done_at", null);
    const { data, error } = await ctx.db.from("admin_secure_ops").insert({ user_id: ctx.me.userId, target }).select("id, expires_at").single();
    if (error || !data) return fail("Չստացվեց սկսել։", 500);
    return NextResponse.json({ op: (data as { id: string }).id, expiresAt: (data as { expires_at: string }).expires_at, options: await authOptions(ctx, "other") });
  },
  async "other.key"(ctx, body) {
    const op = await openOp(ctx, str(body.op));
    if (!op) return fail("Ժամանակը սպառվեց։ Սկսեք նորից։");
    if (!(await keyTouched(ctx, "other", body.response))) return fail("Բանալին չհաստատվեց։ Փորձեք նորից։");
    await ctx.db.from("admin_secure_ops").update({ key_ok: true }).eq("id", op.id);
    const { main, alt } = await addresses(ctx.db, ctx.me);
    const to = op.target === "alt" ? alt : main;
    const url = `${relyingParty(ctx.req).origin}/auth/admin-confirm?t=${op.id}.${op.email_token}`;
    if (to) await sendEmail(adminConfirmChangeEmail({ to, url }));
    return NextResponse.json({ ok: true, sentTo: to });
  },
  async "other.status"(ctx, body) {
    const op = await openOp(ctx, str(body.op));
    return NextResponse.json(op ? { open: true, keyOk: op.key_ok, emailOk: op.email_ok, expiresAt: op.expires_at } : { open: false });
  },
  async "other.finish"(ctx, body) {
    const op = await openOp(ctx, str(body.op));
    if (!op) return fail("Ժամանակը սպառվեց։ Սկսեք նորից։");
    if (!op.key_ok || !op.email_ok) return fail("Նախ հաստատեք բանալիով և նամակի հղումով։");
    const password = str(body.password);
    if (password.length < MIN_PASSWORD) return fail(`Գաղտնաբառը պետք է լինի առնվազն ${MIN_PASSWORD} նշան։`);
    if (op.target === "alt") {
      const { error } = await ctx.db.rpc("admin_set_alt_password", { p_user: ctx.me.userId, p_password: password });
      if (error) return fail(error.message, 500);
    } else {
      await allowCredentialChange(ctx.db, ctx.me.userId);
      const { error } = await ctx.db.auth.admin.updateUserById(ctx.me.userId, { password });
      if (error) return fail(error.message, 500);
    }
    await ctx.db.from("admin_secure_ops").update({ done_at: new Date().toISOString() }).eq("id", op.id);
    await logActivity({ actor: ctx.me.userId, action: "admin.password_changed", ip: ctx.ip, meta: { address: op.target, by: "other address" } });
    await alert(ctx, `Փոխվեց ${op.target === "alt" ? "երկրորդ" : "առաջին"} հասցեի գաղտնաբառը (մյուս հասցեից՝ բանալիով և նամակով)։`);
    return NextResponse.json({ ok: true });
  },
};

type Op = { id: string; target: "main" | "alt"; key_ok: boolean; email_ok: boolean; email_token: string; expires_at: string };
async function openOp(ctx: Ctx, id: string): Promise<Op | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await ctx.db
    .from("admin_secure_ops")
    .select("id, target, key_ok, email_ok, email_token, expires_at")
    .eq("id", id)
    .eq("user_id", ctx.me.userId)
    .is("done_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return (data as Op | null) ?? null;
}

// Before the key, a new device may only pass it.
const BEFORE_KEY = new Set(["verify.options", "verify.verify"]);

async function handlePOST(req: Request) {
  const limited = await tooMany(req, "admin-security", 40, 10);
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as Body;
  const action = str(body.action);
  const db = createAdminClient();

  // The link from the email: no session needed (it may open on the phone).
  if (action === "confirm") {
    const [id, token] = str(body.t).split(".");
    if (!/^[0-9a-f-]{36}$/.test(id ?? "") || !token) return fail("Հղումը սխալ է։");
    const { data } = await db
      .from("admin_secure_ops")
      .update({ email_ok: true })
      .eq("id", id)
      .eq("email_token", token)
      .eq("key_ok", true)
      .is("done_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    return data ? NextResponse.json({ ok: true }) : fail("Հղումն այլևս չի գործում (10 րոպեն անցել է կամ արդեն օգտագործվել է)։");
  }

  const me = await getAdmin();
  if (!me) return fail("Մուտք գործեք որպես ադմին։", 401);
  if (action.startsWith("other.") && !me.isSuper) return fail("Միայն գլխավոր ադմինի համար։", 403);
  if (me.mustChangePassword) return fail("Նախ փոխեք մեկանգամյա գաղտնաբառը։", 403);
  const handler = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!handler) return fail("Անհայտ գործողություն։");
  if (me.needsKey && !BEFORE_KEY.has(action)) return fail(NO_KEY, 403);
  return handler({ me, db, req, ip: clientIp(req) }, body);
}

// A crash or a 5xx answer here is logged and the admins are told.
export const POST = withErrorReport("admin", handlePOST);
