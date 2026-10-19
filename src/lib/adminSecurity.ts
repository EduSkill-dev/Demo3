// Server-only: the super admin's hardened sign-in (see 0074_admin_keys.sql).
//   adm_via   which of the two addresses this session signed in with
//             ("<user>.<main|alt>.<hmac>") — decides whose password the
//             admin may change directly
//   adm_dev   a device that passed the security key ("<device id>.<secret>");
//             the database keeps only the secret's hash, so a device can be
//             revoked
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;
const YEAR = 60 * 60 * 24 * 365;
const enc = new TextEncoder();

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-only"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}
export async function sha256(value: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}
export function randomToken(bytes = 24): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

/* --------------------------------------------------------------- which address */

export async function setVia(userId: string, via: "main" | "alt") {
  const value = `${userId}.${via}`;
  cookies().set("adm_via", `${value}.${await hmac(value)}`, { ...cookieOpts, maxAge: YEAR });
}
export async function viaOf(userId: string): Promise<"main" | "alt"> {
  const raw = cookies().get("adm_via")?.value ?? "";
  const [user, via, sig] = raw.split(".");
  if (user !== userId || (via !== "main" && via !== "alt") || sig !== (await hmac(`${user}.${via}`))) return "main";
  return via;
}

/* ---------------------------------------------------------------- devices */

export async function deviceTrusted(db: Db, userId: string): Promise<boolean> {
  const raw = cookies().get("adm_dev")?.value ?? "";
  const [id, secret] = raw.split(".");
  if (!id || !secret || !/^[0-9a-f-]{36}$/.test(id)) return false;
  const { data } = await db.from("admin_devices").select("token_hash, revoked, last_seen_at").eq("id", id).eq("user_id", userId).maybeSingle();
  const row = data as { token_hash: string; revoked: boolean; last_seen_at: string } | null;
  if (!row || row.revoked || row.token_hash !== (await sha256(secret))) return false;
  // "Last seen" to the hour is enough; no write on every page.
  if (Date.now() - new Date(row.last_seen_at).getTime() > 3_600_000) {
    await db.from("admin_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", id);
  }
  return true;
}
export async function trustDevice(db: Db, userId: string, label: string) {
  const secret = randomToken(32);
  const { data } = await db.from("admin_devices").insert({ user_id: userId, token_hash: await sha256(secret), label: label.slice(0, 120) }).select("id").single();
  if (data) cookies().set("adm_dev", `${(data as { id: string }).id}.${secret}`, { ...cookieOpts, maxAge: YEAR });
}
export function deviceIdOf(): string | null {
  const id = (cookies().get("adm_dev")?.value ?? "").split(".")[0];
  return /^[0-9a-f-]{36}$/.test(id) ? id : null;
}
export async function hasKeys(db: Db, userId: string): Promise<boolean> {
  const { count } = await db.from("admin_keys").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return (count ?? 0) > 0;
}

/* ---------------------------------------------------------------- sessions */

// A session for an account without its Supabase password (the second
// address's own password, or a recovery code): a one-time sign-in link made
// on the server and used at once, never emailed.
export async function sessionFor(db: Db, email: string): Promise<boolean> {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return false;
  const { error: verifyError } = await (await createClient()).auth.verifyOtp({ type: "magiclink", token_hash: hash });
  return !verifyError;
}

// WebAuthn: the relying party is the site's own host.
export function relyingParty(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const rpID = host.split(":")[0];
  return { rpID, origin: `${proto}://${host}`, rpName: "Culmen" };
}

// A key holder's password (or address) changes only right after this — the
// database refuses it otherwise (0075_admin_password_guard.sql).
export async function allowCredentialChange(db: Db, userId: string) {
  await db.from("admin_password_grants").upsert({ user_id: userId, expires_at: new Date(Date.now() + 60_000).toISOString() });
}

// Ten recovery codes like "K7QM-2XPA-9TRE": 60 bits each, no look-alikes.
export function newRecoveryCodes(): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => {
    const b = crypto.getRandomValues(new Uint8Array(12));
    const s = Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
  });
}
export const normalizeCode = (code: string) => {
  const s = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 12 ? `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}` : "";
};

// "Chrome · Windows" — enough to tell one's own devices apart in the list.
export function deviceLabel(req: Request): string {
  const ua = req.headers.get("user-agent") ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Դիտարկիչ";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}
